// ALLOWS LINE BREAKS WITH RETURN BUTTON
marked.setOptions({
  breaks: true,
});

// INSERTS target="_blank" INTO HREF TAGS (required for codepen links)
const renderer = new marked.Renderer();
renderer.link = function (href, title, text) {
  return `<a target="_blank" href="${href}">${text}` + '</a>';
}
const markdownToHTML = markdownText => marked(markdownText, { renderer: renderer });

class Storage {
  constructor(type) {
    if (this._storageAvailable(type)) {
      this.storage = window[type];
    } else {
      console.log(`Your browser doesn't support ${type}!`);
    }
  }

  get markdownText() {
    if (this.storage) return this.storage.getItem("markdown-text");
  }

  set markdownText(text) {
    if (this.storage) this.storage.setItem("markdown-text", text);
  }

  get themeSelected() {
    if (this.storage) return this.storage.getItem("theme-selected");
  }

  set themeSelected(themeName) {
    if (this.storage) this.storage.setItem("theme-selected", themeName);
  }

  _storageAvailable(type) {
    try {
      var storage = window[type],
        x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    }
    catch (e) {
      console.log(e);
      return e instanceof DOMException && (
        // everything except Firefox
        e.code === 22 ||
        // Firefox
        e.code === 1014 ||
        // test name field too, because code might not be present
        // everything except Firefox
        e.name === 'QuotaExceededError' ||
        // Firefox
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
        // acknowledge QuotaExceededError only if there's something already stored
        storage.length !== 0;
    }
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);

    this.mapThemeLoaded = {};
    this.storage = new Storage("localStorage");
    this.state = {
      editMode: false,
      readerMode: false,
      isOpenFromDisk: false,
      isResetToDefault: false,
      themeSelected: this.storage.themeSelected || this.props.defaultTheme,
      markdownText: this.storage.markdownText || this.props.defaultText
    }

    this.onTextChanged = this.onTextChanged.bind(this);
    this.onToggleEditMode = this.onToggleEditMode.bind(this);
    this.onToggleReaderMode = this.onToggleReaderMode.bind(this);
    this.onSaveAsHTML = this.onSaveAsHTML.bind(this);
    this.onOpenFromDisk = this.onOpenFromDisk.bind(this);
    this.onEditorScroll = this.onEditorScroll.bind(this);
    this.onPreviewScroll = this.onPreviewScroll.bind(this);
    this.setOpenFromDiskFinished = this.setOpenFromDiskFinished.bind(this);
    this.onThemeSelectChanged = this.onThemeSelectChanged.bind(this);
    this.onResetToDefault = this.onResetToDefault.bind(this);
    this.setResetToDefaultFinished = this.setResetToDefaultFinished.bind(this);

    this.loadCodeMirrorThemeCSS(this.state.themeSelected);
  }

  loadCodeMirrorThemeCSS(name) {
    if (name === this.props.defaultTheme || this.mapThemeLoaded[name]) return;

    this.mapThemeLoaded[name] = true;

    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = `./lib/codemirror-5.39.2/theme/${name}.css`;

    const head = document.getElementsByTagName('head')[0];
    head.appendChild(link);

    return link;
  }

  setOpenFromDiskFinished() {
    this.setState({
      isOpenFromDisk: false
    });
  }

  setResetToDefaultFinished() {
    this.setState({
      isResetToDefault: false
    });
  }

  onThemeSelectChanged({ target }) {
    const name = target.value;
    this.storage.themeSelected = name;

    this.loadCodeMirrorThemeCSS(name);
    this.setState({
      themeSelected: name
    });
  }

  onResetToDefault() {
    this.storage.themeSelected = this.props.defaultTheme;
    this.storage.markdownText = this.props.defaultText;

    this.setState({
      isResetToDefault: true,
      themeSelected: this.props.defaultTheme,
      markdownText: this.props.defaultText
    });
  }

  onToggleEditMode() {
    const newEditModeState = !this.state.editMode;
    const newReaderModeState = newEditModeState ? false : this.state.readerMode;

    this.setState({
      readerMode: newReaderModeState,
      editMode: newEditModeState
    });
  }

  onToggleReaderMode() {
    const newReaderModeState = !this.state.readerMode;
    const newEditModeState = newReaderModeState ? false : this.state.editMode;

    this.setState({
      readerMode: newReaderModeState,
      editMode: newEditModeState
    });
  }

  onSaveAsHTML() {
    const content = markdownToHTML(this.state.markdownText);
    const fileName = "export.html";

    if (navigator.msSaveBlob) { // IE
      navigator.msSaveBlob(new Blob([content], { type: 'text/html;charset=utf-8;' }), fileName);
    } else {
      const a = document.createElement('a');
      a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(content);
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  onOpenFromDisk() {
    const input = document.body.appendChild(
      document.createElement("input")
    );
    input.setAttribute("type", "file");
    input.setAttribute("accept", ".md, .txt");

    input.addEventListener("change", ({ target }) => {
      if (target.files && target.files[0]) {
        const fileReader = new FileReader();
        fileReader.onload = ({ target }) => {
          const text = target.result;
          this.storage.markdownText = text;

          this.setState({
            markdownText: text,
            isOpenFromDisk: true
          });
          document.body.removeChild(input);
        }
        fileReader.readAsText(target.files[0]);
      }
    });
    input.click();
  }

  onTextChanged({ target }) {
    const text = target.value;
    this.storage.markdownText = text;

    this.setState({
      markdownText: text
    });
  }

  componentDidMount() {
    const root = ReactDOM.findDOMNode(this);
    this.previewElm = root.querySelector('#preview');
    this.editorElm = root.querySelector('.CodeMirror-vscrollbar');

    if (this.previewElm) this.previewElm.addEventListener('scroll', this.onPreviewScroll);
    if (this.editorElm) this.editorElm.addEventListener('scroll', this.onEditorScroll);
  }

  onPreviewScroll() {
    this.editorElm.removeEventListener("scroll", this.onEditorScroll);
    this.editorElm.scrollTop = this.previewElm.scrollTop;

    window.clearTimeout(this.isPreviewScrolling);
    this.isPreviewScrolling = setTimeout(() => {
      this.editorElm.addEventListener("scroll", this.onEditorScroll);
    }, 66);
  }

  onEditorScroll() {
    this.previewElm.removeEventListener("scroll", this.onPreviewScroll);
    this.previewElm.scrollTop = this.editorElm.scrollTop;

    window.clearTimeout(this.isEditorScrolling);
    this.isEditorScrolling = setTimeout(() => {
      this.previewElm.addEventListener("scroll", this.onPreviewScroll);
    }, 66);
  }

  render() {
    return (
      <div>
        <NavBar
          editMode={this.state.editMode}
          readerMode={this.state.readerMode}
          themeSelected={this.state.themeSelected}
          defaultTheme={this.props.defaultTheme}
          themes={this.props.themes}
          onToggleEditMode={this.onToggleEditMode}
          onToggleReaderMode={this.onToggleReaderMode}
          onSaveAsHTML={this.onSaveAsHTML}
          onOpenFromDisk={this.onOpenFromDisk}
          onThemeSelectChanged={this.onThemeSelectChanged}
          onResetToDefault={this.onResetToDefault}
        />
        <div className="workspace">
          <Editor
            markdownText={this.state.markdownText}
            editMode={this.state.editMode}
            readerMode={this.state.readerMode}
            themeSelected={this.state.themeSelected}
            isOpenFromDisk={this.state.isOpenFromDisk}
            isResetToDefault={this.state.isResetToDefault}
            onTextChanged={this.onTextChanged}
            setOpenFromDiskFinished={this.setOpenFromDiskFinished}
            setResetToDefaultFinished={this.setResetToDefaultFinished}
          />
          <Previewer
            markdownText={this.state.markdownText}
            readerMode={this.state.readerMode}
            editMode={this.state.editMode}
          />
        </div>
      </div>
    )
  }
}

class NavBar extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    const root = ReactDOM.findDOMNode(this);
    this.themeSelectElm = root.querySelector('select');

    for (var i = 0; i < this.themeSelectElm.options.length; i++) {
      if (this.themeSelectElm.options[i].value === this.props.themeSelected) {
        this.themeSelectElm.selectedIndex = i;
        break;
      }
    }
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.editMode !== this.props.editMode ||
      nextProps.readerMode !== this.props.readerMode ||
      nextProps.themeSelected !== this.props.themeSelected;
  }

  componentDidUpdate() {
    for (var i = 0; i < this.themeSelectElm.options.length; i++) {
      if (this.themeSelectElm.options[i].value === this.props.themeSelected) {
        this.themeSelectElm.selectedIndex = i;
        break;
      }
    }
  }

  render() {
    const editModeClassName = "fas fa-pencil-alt navbar-wrapper-icon" + (this.props.editMode ? " choosen" : "");
    const readerModeClassName = "fas fa-eye navbar-wrapper-icon" + (this.props.readerMode ? " choosen" : "");
    const saveAsHTMLClassName = "fas fa-download navbar-wrapper-icon";
    const openFromDiskClassName = "fas fa-upload navbar-wrapper-icon";
    const resetToDefaultClassName = "fas fa-undo navbar-wrapper-icon";

    return (
      <nav className="navbar">
        <div className="navbar-wrapper name">
          <h1 className="navbar-wrapper-name">
            <a href="#">Markdown Previewer</a>
          </h1>
        </div>
        <div className="navbar-wrapper">
          <select className="navbar-wraper-select-theme" onChange={this.props.onThemeSelectChanged} title="Change theme">
            <option value="select-a-theme" disabled>Select a theme</option>
            <option value={this.props.defaultTheme}>default</option>
            {
              this.props.themes.map((themeName, index) => {
                return <option key={index} value={themeName}>{themeName}</option>
              })
            }
          </select>
          <i className={editModeClassName} onClick={this.props.onToggleEditMode} title="Edit mode"></i>
          <i className={readerModeClassName} onClick={this.props.onToggleReaderMode} title="Reader mode"></i>
          <i className={saveAsHTMLClassName} onClick={this.props.onSaveAsHTML} title="Save as HTML"></i>
          <i className={openFromDiskClassName} onClick={this.props.onOpenFromDisk} title="Open from Disk"></i>
          <i className={resetToDefaultClassName} onClick={this.props.onResetToDefault} title="Reset to Default"></i>
        </div>
      </nav>
    )
  }
}

class Editor extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    const root = ReactDOM.findDOMNode(this);
    const textarea = root.querySelector('#editor');
    const themeSelected = this.props.themeSelected;

    this.codeMirrorEditor = CodeMirror.fromTextArea(textarea, {
      mode: "markdown",
      theme: themeSelected
    });

    this.codeMirrorEditor.on("change", _ => {
      this.props.onTextChanged({
        target: {
          value: this.codeMirrorEditor.getValue()
        }
      });
    });
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.markdownText !== this.props.markdownText ||
      nextProps.editMode !== this.props.editMode ||
      nextProps.readerMode !== this.props.readerMode ||
      nextProps.themeSelected !== this.props.themeSelected;
  }

  componentDidUpdate() {
    if (this.props.isOpenFromDisk) {
      this.codeMirrorEditor.setValue(this.props.markdownText);
      this.props.setOpenFromDiskFinished();
    } else if (this.props.isResetToDefault) {

      this.codeMirrorEditor.setValue(this.props.markdownText);
      this.props.setResetToDefaultFinished();
    }
    this.codeMirrorEditor.setOption("theme", this.props.themeSelected);
  }

  render() {
    const editorClassName = "editor " + (this.props.editMode ? "center" : this.props.readerMode ? "hide" : "");

    return (
      <div className={editorClassName}>
        <textarea id="editor" className="editor-textarea"
          onChange={this.props.onTextChanged}
          value={this.props.markdownText}>
        </textarea>
      </div>
    )
  }
}

class Previewer extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const previewerClassName = "previewer " + (this.props.readerMode ? "center" : this.props.editMode ? "hide" : "");
    const htmlContent = markdownToHTML(this.props.markdownText);

    return (
      <div className={previewerClassName}>
        <div id="preview"
          className="previewer-content"
          dangerouslySetInnerHTML={{ __html: htmlContent }}>
        </div>
      </div>
    )
  }
}

const defaultText =
  `# Welcome to my React Markdown Previewer!

## This is a sub-heading...
### And here's some other cool stuff:
  
Heres some code, \`<div></div>\`, between 2 backticks.

\`\`\`
// this is multi-line code:

function anotherExample(firstLine, lastLine) {
  if (firstLine == '\`\`\`' && lastLine == '\`\`\`') {
    return multiLineCode;
  }
}
\`\`\`
  
You can also make text **bold**... whoa!
Or _italic_.
Or... wait for it... **_both!_**
And feel free to go crazy ~~crossing stuff out~~.

There's also [links](https://www.freecodecamp.com), and
> Block Quotes!

And if you want to get really crazy, even tables:

Wild Header | Crazy Header | Another Header?
------------ | ------------- | ------------- 
Your content can | be here, and it | can be here....
And here. | Okay. | I think we get it.

- And of course there are lists.
  - Some are bulleted.
     - With different indentation levels.
        - That look like this.


1. And there are numbererd lists too.
1. Use just 1s if you want! 
1. But the list goes on...
- Even if you use dashes or asterisks.
* And last but not least, let's not forget embedded images:

![React Logo w/ Text](https://goo.gl/Umyytc)
`

const codeMirrors = [
  "3024-day",
  "3024-night",
  "abcdef",
  "ambiance-mobile",
  "ambiance",
  "base16-dark",
  "base16-light",
  "bespin",
  "blackboard",
  "cobalt",
  "colorforth",
  "darcula",
  "dracula",
  "duotone-dark",
  "duotone-light",
  "eclipse",
  "elegant",
  "erlang-dark",
  "gruvbox-dark",
  "hopscotch",
  "icecoder",
  "idea",
  "isotope",
  "lesser-dark",
  "liquibyte",
  "lucario",
  "material",
  "mbo",
  "mdn-like",
  "midnight",
  "monokai",
  "neat",
  "neo",
  "night",
  "oceanic-next",
  "panda-syntax",
  "paraiso-dark",
  "paraiso-light",
  "pastel-on-dark",
  "railscasts",
  "rubyblue",
  "seti",
  "shadowfox",
  "solarized",
  "ssms",
  "the-matrix",
  "tomorrow-night-bright",
  "tomorrow-night-eighties",
  "ttcn",
  "twilight",
  "vibrant-ink",
  "xq-dark",
  "xq-light",
  "yeti",
  "zenburn"
];

const defaultTheme = "default";

const rootNode = document.querySelector("#app");
ReactDOM.render(
  <App defaultText={defaultText} themes={codeMirrors} defaultTheme={defaultTheme} />,
  rootNode
);