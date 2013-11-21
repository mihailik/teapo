/// <reference path='typings/knockout.d.ts' />
/// <reference path='persistence.ts' />

module teapo {

  /**
   * File list or tree ViewModel.
   */
  export class FileList {

    folders = ko.observableArray<FolderEntry>();
    files = ko.observableArray<FileEntry>();
    selectedFile = ko.observable<FileEntry>(null);

    private _filesByFullPath: { [fullPath: string]: FileEntry; } = {};

    constructor(private _storage: DocumentStorage) {
      var fileNames = this._storage.documentNames();
      for (var i = 0; i < fileNames.length; i++) {
        this._addFileEntry(fileNames[i]);
      }
    }

    private _addFileEntry(fullPath: string): void {
      var pathParts = normalizePath(fullPath);
      if (pathParts.length===0)
        return; // empty path - noop

      var parent: RuntimeFolderEntry = null;
      var folders = this.folders;
      var files = this.files;

      for (var i = 0; i < pathParts.length-1; i++) {
        var folder = this._insertOrLookupFolder(parent, folders, pathParts, i);

        folders = folder.folders;
        files = folder.files;
        parent = folder;
      }

      var fileName = pathParts[pathParts.length-1];

      var fileArray = files();
      var fileIndex = insertionIndexOfEntry(fileArray, fileName);
      var file = <RuntimeFileEntry>fileArray[fileIndex];

      if (file && file.name()===fileName)
        throw new Error('File already exists: '+file.fullPath()+'.');

      file = new RuntimeFileEntry(
        '/'+pathParts.join('/'),
        fileName,
        parent,
        this,
        () => this._handleFileClick(file));

      files.splice(fileIndex, 0, file);
    }

    private _insertOrLookupFolder(
      parent: RuntimeFolderEntry,
      folders: KnockoutObservableArray<FolderEntry>,
      pathParts: string[],
      i: number): RuntimeFolderEntry {
      var folderName = pathParts[i];

      var folderArray = folders();
      var folderIndex = insertionIndexOfEntry(folderArray, folderName);
      var folder = <RuntimeFolderEntry>folderArray[folderIndex];

      if (!folder || folder.name()!==folderName) {
        var folderPath = '/'+pathParts.slice(0,i+1).join('/');
        folder = new RuntimeFolderEntry(
          folderPath,
          folderName,
          parent,
          this,
          () => this._handleFolderClick(folder));
        folders.splice(folderIndex, 0, folder);
      }

      return folder;
    }

    private _handleFolderClick(folder: RuntimeFolderEntry) {
    }

    private _handleFileClick(file: RuntimeFileEntry) {
    }
  }

  /**
   * Folder entry in file list or tree.
   */
  export interface FolderEntry {

    fullPath(): string;
    name(): string;

    folders: KnockoutObservableArray<FolderEntry>;
    files: KnockoutObservableArray<FileEntry>;

    handleClick(): void;
  }

  /**
   * File entry in file list or tree.
   */
  export interface FileEntry {

    fullPath(): string;
    name(): string;

    isSelected: KnockoutObservable<boolean>;

    handleClick(): void;
  }

  class RuntimeFolderEntry implements teapo.FolderEntry {

    folders = ko.observableArray<teapo.FolderEntry>();
    files = ko.observableArray<teapo.FileEntry>();

    constructor(
      private _fullPath: string,
      private _name: string,
      private _parent: FolderEntry,
      private _owner: FileList,
      private _handleClick: () => void) {
      //
    }

    fullPath(): string { return this._fullPath; }
    name(): string { return this._name; }

    handleClick(): void {
      this._handleClick();
    }
 }

  class RuntimeFileEntry implements teapo.FileEntry {

    isSelected = ko.observable<boolean>(false);

    constructor(
      private _fullPath: string,
      private _name: string,
      private _parent: FolderEntry,
      private _owner: FileList,
      private _handleClick: () => void) {
      //
    }

    fullPath(): string { return this._fullPath; }
    name(): string { return this._name; }

    handleClick(): void {
      this._handleClick();
    }
  }

  function insertionIndexOfEntry(entries: { name(): string; }[], name: string): number {
    for (var i = 0; i < entries.length; i++) {
      var entryName = entries[i].name();
      if (entryName >= name)
        return i;
    }
    return entries.length;
  }

  /**
   * Convert string path into an array of path parts,
   * processing '..' as necessary.
   */
  function normalizePath(path: string): string[] {
    if (!path) return [];

    var pathMid = stripOuterSlashes(path);
    var split = pathMid.split('/');

    var result: string[] = null;
    for (var i = 0; i < split.length; i++) {
      if (split[i]==='..') {
        if (result.length)
          result.length--;
        continue;
      }
      else if (split[i]==='.' || split[i]==='') {
        continue;
      }
      else {
        result.push(split[i]);
      }
    }
  }

  function stripOuterSlashes(path: string) {
    var start = 0;
    while (path.charAt(start)==='/')
      start ++;

    var end = Math.max(start, path.length-1);
    while (end>=start && path.charAt(end)==='/')
      end--;

    var pathMid = start===0 && end===path.length-1 ? path : path.slice(start,end);
    return pathMid;
  }
}