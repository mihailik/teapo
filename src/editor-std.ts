/// <reference path='typings/codemirror.d.ts' />

/// <reference path='persistence.ts' />
/// <reference path='editor.ts' />

// anchor-2

module teapo {

  /**
   * Basic implementation for a text-based editor.
   */
  export class CodeMirrorEditor implements Editor {
    private _doc: CodeMirror.Doc = null;
    private _invokeonchange: () => void;
    private _text: string = null;
    private _positionOnOpen = false;

    static positionSaveDelay = 400;

    constructor(
      private _shared: CodeMirrorEditor.SharedState,
      public docState: DocumentState) {
    }

    static standardEditorConfiguration(): CodeMirror.Options {
      return {
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        matchTags: true,
        showTrailingSpace: true,
        autoCloseTags: true,
        //highlightSelectionMatches: {showToken: /\w/},
        styleActiveLine: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        tabSize: 2,
        extraKeys: {"Tab": "indentMore", "Shift-Tab": "indentLess"}
      };
    }

    /**
     * Invoked when a file is selected in the file list/tree and brought open.
     */
    open(onchange: () => void): HTMLElement {

      this._shared.editor = this;

      // storing passed function
      // (it should be invoked for any change to trigger saving)
      this._invokeonchange = onchange;

      // this may actually create CodeMirror instance
      var editor = this.editor();
      var doc = this.doc();

      editor.swapDoc(doc);

      // invoking overridable logic
      this.handleOpen();

      var element = this._shared.element;
      if (element && !element.parentElement) {
        setTimeout(() => {
          editor.refresh();
          editor.focus();

          if (this._positionOnOpen) {

            this._positionOnOpen = false;
            var posStr = this.docState.getProperty('pos');
            if (typeof posStr==='string' && posStr) {
              try {
                var pos = JSON.parse(posStr);
                this._doc.setCursor(pos);
                editor.scrollIntoView(doc.getCursor());
              }
              catch (parsePosError) { }
            }
          }

        }, 1);
      }
      else {
        setTimeout(() => editor.focus(), 1);
      }
      return element;
    }

    /**
     * Invoked when file needs to be saved.
     */
    save() {
      // invoking overridable logic
      this.handleSave();
    }

    /**
     * Invoked when file is closed (normally it means another one is being opened).
     */
    close() {

      if (this._shared.editor===this)
        this._shared.editor = null;

      // should not try triggering a save when not opened
      this._invokeonchange = null;
      this.handleClose();
    }

    remove() {
      this.handleRemove();
    }


    /**
     * Retrieve CodeMirror.Doc that is solely used for this document editing.
     */
    doc() {
      if (!this._doc)
        this._initDoc();

      return this._doc;
    }

    /**
     * Retrieve CodeMirror editor that normally is shared with other documents of the same type.
     * Be careful not to use it when this specific document is closed.
     */
    editor() {
      // note that editor instance is shared
      if (!this._shared.cm)
        this._initEditor();

      return this._shared.cm;
    }

    /**
     * Retrieve the text of this document.
     * This property is cached, so retrieving the text is cheap between the edits.
     * If the document has never been edited, the text is retrieved from the storage instead,
     * which is much cheaper still.
     */
    text(): string {
      if (!this._text) {
        if (this._doc)
          this._text= this._doc.getValue();
        else
          this._text = this.docState.getProperty(null) ||'';
      }
      return this._text;
    }

    /**
     * Overridable method, invoked when the document is being opened.
     */
    handleOpen() {
    }

    /**
     * Overridable method, invoked when the document has been changed.
     * CodeMirrorEditor subscribes to corresponding event internally, and does some internal handling before invoking handleChange.
     */
    handleChange(change: CodeMirror.EditorChange) {
    }

    /**
     * Overridable method, invoked when the document is being closed.
     */
    handleClose() {
    }

    /**
     * Overridable method, invoked when the file was removed and the editor needs to be destroyed.
     */
    handleRemove() {
    }

    /**
     * Overridable method, invoked when the document is being loaded first time from the storage.
     * The default implementation fetches 'null' property from the storage.
     * Keep calling super.handleLoad() if that is the desired behavior.
     */
    handleLoad() {
      if (this.docState) {
        this.doc().setValue(this.docState.getProperty(null) || '');
        this.doc().clearHistory();
      }
    }

    /**
     * Overridable method, invoked when the document needs to be saved.
     * The default implementation stores into 'null' property of the storage.
     * Keep calling super.handleSave() if that is the desired behavior.
     */
    handleSave() {
      if (this.docState)
        this.docState.setProperty(null, this.text());
    }


    /**
     * Retrieves parts of the line before and after current cursor,
     * looking for indentifier and whitespace boundaries.
     * Needed for correct handling of completion context.
     */
    getNeighborhood() {
      var doc = this.doc();
      var pos = doc.getCursor();
      var offset = doc.indexFromPos(pos);
      var line = doc.getLine(pos.line);

      var leadLength = 0;
      var prefixChar = '';
      var whitespace = false;
      for (var i = pos.ch-1; i >=0; i--) {
        var ch = line[i];
        if (!whitespace && this._isIdentifierChar(ch)) {
          leadLength++;
          continue;
        }

        whitespace = /\s/.test(ch);
        if (!whitespace) {
          prefixChar = ch;
          break;
        }
      }

      var tailLength = 0;
      var suffixChar = '';
      whitespace = false;
      for (var i = pos.ch; i <line.length; i++) {
        var ch = line[i];
        if (!whitespace && this._isIdentifierChar(ch)) {
          tailLength++;
          continue;
        }

        whitespace = /\s/.test(ch);
        if (!whitespace) {
          suffixChar = ch;
          break;
        }
      }

      return {
        pos: pos,
        offset: offset,
        line: line,
        leadLength: leadLength,
        prefixChar: prefixChar,
        tailLength: tailLength,
        suffixChar: suffixChar
      };
    }

    /** More specifially, number or identifier (numbers, letters, underscore and dollar). */
    private _isIdentifierChar(ch: string): boolean {
      if (ch.toLowerCase()!==ch.toUpperCase())
        return true;
      else if (ch==='_' || ch==='$')
        return true;
      else if (ch>='0' && ch<='9')
        return true;
      else
        return false;
    }


    private _initEditor() {
      var options = this._shared.options || CodeMirrorEditor.standardEditorConfiguration();
      this._shared.cm = new CodeMirror(
        (element) => this._shared.element = element,
        options);
    }

    private _initDoc() {

      // resolve options (allow override)
      var options = this._shared.options || CodeMirrorEditor.standardEditorConfiguration();
      this._doc =
        options.mode ? new CodeMirror.Doc('', options.mode) :
        new CodeMirror.Doc('');

      this._positionOnOpen = true;

      // invoke overridable handleLoad()
      this.handleLoad();

      // subscribe to change event
      CodeMirror.on(
        this._doc,
        'change',
        (instance, change) => {

          // it is critical that _text is cleared on any change
          this._text = null;

          // notify the external logic that the document was changed
          this._invokeonchange();

          this.handleChange(change);
        });
    }

  }

  export module CodeMirrorEditor {

    /**
     * Editors need to share a CodeMirror instance, and physical HTML element.
     * CodeMirror options therefore must be decided centrally too.
     * Note that all the properties are optional, they are going to be assigned by CodeMirrorEditor.
     */
    export interface SharedState {
      editor?: CodeMirrorEditor;
      cm?: CodeMirror;
      element?: HTMLElement;
      options?: CodeMirror.Options;
    }
  }

  export class CompletionCodeMirrorEditor extends CodeMirrorEditor {

    static completionDelay = 400;

    private _completionTimeout = 0;
    private _completionClosure = () => this._performCompletion();
    private _forcedCompletion = false;
    private _acceptSingleCompletion = false;
    private static _noSingleAutoCompletion = { completeSingle: false };
    private _positionSaveTimeout = 0;
    private _positionSaveClosure = () => this._performPositionSave();

    constructor(
      shared: CodeMirrorEditor.SharedState,
      docState: DocumentState) {
      super(CompletionCodeMirrorEditor.injectCompletionShortcuts(shared), docState);
    }

    /**
     * Subscribing to cursor activity.
     */
    handleLoad() {
      super.handleLoad(); // fetches the text from docState

      CodeMirror.on(
        this.doc(),
        'cursorActivity', (instance) => this._oncursorActivity());
    }

    handleClose() {

      // completion should be cancelled outright
      if (this._completionTimeout) {
        clearTimeout(this._completionTimeout);

        this._completionTimeout = 0;
      }
    }

    handleCursorActivity() {
    }

    handlePerformCompletion(forced: boolean, acceptSingle: boolean) {
    }

    handleChange(change: CodeMirror.EditorChange) {
      this.triggerCompletion(false);
    }

    triggerCompletion(forced: boolean, acceptSingle = false) {
      if (this._completionTimeout)
        clearTimeout(this._completionTimeout);

      if (forced)
        this._forcedCompletion = true;
      if (acceptSingle)
        this._acceptSingleCompletion = true;

      var delay = forced ? 1 : CompletionCodeMirrorEditor.completionDelay;

      this._completionTimeout = setTimeout(this._completionClosure, delay);
    }

    cancelCompletion() {
      // completion should be cancelled outright
      if (this._completionTimeout) {
        clearTimeout(this._completionTimeout);

        this._completionTimeout = 0;
      }

      this._forcedCompletion = false;
      this._acceptSingleCompletion = false;
    }

    private _performCompletion() {
      this._completionTimeout = 0;

      if (!this._forcedCompletion) {
        // if user didn't ask for completion, only do it within an identifier
        // or after dot
        var nh = this.getNeighborhood();
        if (nh.leadLength===0 && nh.prefixChar!=='.')
          return;
      }

      var forced = this._forcedCompletion;
      var acceptSingle = this._acceptSingleCompletion;
      this._forcedCompletion = false;
      this._acceptSingleCompletion = false;
      this.handlePerformCompletion(forced, acceptSingle);
    }

    private _oncursorActivity() {
//      if (this._completionTimeout) {
//        clearTimeout(this._completionTimeout);
//        this._completionTimeout = 0;
//      }

      this.handleCursorActivity();

      if (this._positionSaveTimeout)
        clearTimeout(this._positionSaveTimeout);
      this._positionSaveTimeout = setTimeout(this._positionSaveClosure, CodeMirrorEditor.positionSaveDelay);
    }

    private _performPositionSave() {
      if (this._positionSaveTimeout) {
        clearTimeout(this._positionSaveTimeout);
        this._positionSaveTimeout = 0;
      }

      // save current position
      var pos = this.editor().getDoc().getCursor();
      var posStr = JSON.stringify(pos);
      this.docState.setProperty('pos', posStr);
    }

    private static injectCompletionShortcuts(shared: CodeMirrorEditor.SharedState) {
      var triggerEditorCompletion = () => {
        var editor = <CompletionCodeMirrorEditor>shared.editor;
        if (!editor) return;
        editor.triggerCompletion(true, true);
      };

      var completionShortcuts = ['Ctrl-Space','Cmd-Space','Alt-Space','Ctrl-J','Alt-J','Cmd-J'];
      var extraKeys = shared.options.extraKeys;
      if (!extraKeys)
        extraKeys = shared.options.extraKeys = {};

      for (var i = 0; i < completionShortcuts.length; i++) {
        var key = completionShortcuts[i];
        if (key in extraKeys)
          continue;
        extraKeys[key] = triggerEditorCompletion;
      }

      return shared;
    }
  }


  /**
   * Simple document type using CodeMirrorEditor, usable as a default type for text files.
   */
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

    /**
     * Registering PlainTextEditorType.
     */
    export var PlainText: EditorType = new PlainTextEditorType();
  }
}