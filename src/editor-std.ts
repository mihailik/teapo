/// <reference path='typings/codemirror.d.ts' />

/// <reference path='persistence.ts' />
/// <reference path='editor.ts' />

module teapo {

  export class CodeMirrorEditor implements Editor {
    private _doc: CodeMirror.Doc = null;
    private _invokeonchange: () => void;
    private _text: string = null;

    constructor(private _shared: CodeMirrorEditor.SharedState, public docState?: DocumentState) {
    }

    static standardEditorConfiguration(): CodeMirror.EditorConfiguration {
      return {
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        matchTags: true,
        showTrailingSpace: true,
        autoCloseTags: true,
        highlightSelectionMatches: {showToken: /\w/},
        styleActiveLine: true,
        // readOnly: 'nocursor',
        tabSize: 2,
        extraKeys: {"Tab": "indentMore", "Shift-Tab": "indentLess"}
      };
    }

    open(onchange: () => void): HTMLElement {
      this._invokeonchange = onchange;

      var editor = this.editor();

      var element = this._shared.element;
      if (element && !element.parentElement)
        setTimeout(() => editor.refresh(), 1);
  
      editor.swapDoc(this.doc());
  
      this.handleOpen();

      return element;
    }

    save() {
      this.handleSave();
    }

    close() {
      this._invokeonchange = null;
      this.handleClose();
    }

    doc() {
      if (!this._doc)
        this._initDoc();
  
      return this._doc;
    }

    editor() {
      if (!this._shared.editor)
        this._initEditor();

      return this._shared.editor;
    }

    text(): string {
      if (!this._text) {
        if (this._doc)
          this._text= this._doc.getValue();
        else
          this._text = this.docState.getProperty(null);
      }
      return this._text;
    }

    handleOpen() {
    }

    handleChange(change: CodeMirror.EditorChange) {
    }

    handleClose() {
    }

    handleLoad() {
      if (this.docState) {
        this.doc().setValue(this.docState.getProperty(null) || '');
        this.doc().clearHistory();
      }
    }

    handleSave() {
      if (this.docState)
        this.docState.setProperty(null, this.text());
    }

    private _initEditor() {
      var options = this._shared.options || CodeMirrorEditor.standardEditorConfiguration();
      this._shared.editor = CodeMirror(
        (element) => this._shared.element = element,
        options);
    }

    private _initDoc() {
      this._doc = new CodeMirror.Doc('');
      this.handleLoad();
      CodeMirror.on(
        this._doc,
        'change',
        (instance, change) => {
          this._text = null;
          this._invokeonchange();
          this.handleChange(change);
        });
    }
  }

  export module CodeMirrorEditor {
    export interface SharedState {
      editor?: CodeMirror.Editor;
      element?: HTMLElement;
      options?: CodeMirror.EditorConfiguration;
    }
  }


  class PlainTextEditorType implements EditorType {
    private _shared: CodeMirrorEditor.SharedState = {};

    constructor() {
    }

    canEdit(fullPath: string): boolean {
      return true;
    }

    editDocument(docState: DocumentState): Editor {
      return new CodeMirrorEditor(this._shared, docState);
    }
  }

  export module EditorType {
    export var PlainText: EditorType = new PlainTextEditorType();
  }
}