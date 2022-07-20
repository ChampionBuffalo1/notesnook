import Collection from "./collection";
import { makeId } from "../utils/id";
import { deleteItems, hasItem } from "../utils/array";
import setManipulator from "../utils/set";
import { Mutex } from "async-mutex";

export default class Tags extends Collection {
  init() {
    this.mutex = new Mutex();
  }

  tag(id) {
    const tagItem = this.all.find((t) => t.id === id || t.title === id);
    return tagItem;
  }

  async merge(tag) {
    if (!tag.migrated) return;
    await this._collection.addItem(tag);
  }

  async add(tagId, ...noteIds) {
    return this.mutex.runExclusive(async () => {
      tagId = this.sanitize(tagId);
      if (!tagId) throw new Error("Tag title cannot be empty.");

      let tag = this.tag(tagId);

      if (tag && !noteIds.length)
        throw new Error("A tag with this id already exists.");

      tag = tag || {
        title: tagId,
      };

      let id = tag.id || makeId(tag.title.toLowerCase());
      let notes = tag.noteIds || [];

      tag = {
        type: "tag",
        id,
        title: tag.title,
        noteIds: setManipulator.union(notes, noteIds),
        localOnly: true,
      };

      await this._collection.addItem(tag);
      if (!this._db.settings.getAlias(tag.id))
        await this._db.settings.setAlias(tag.id, tag.title);
      return tag;
    });
  }

  async rename(tagId, newName) {
    let tag = this.tag(tagId);
    if (!tag) {
      console.error(`No tag found. Tag id:`, tagId);
      return;
    }

    newName = this.sanitize(newName);
    if (!newName) throw new Error("Tag title cannot be empty.");

    await this._db.settings.setAlias(tagId, newName);
    await this._collection.addItem({ ...tag, alias: newName });
  }

  alias(tagId) {
    let tag = this.tag(tagId);
    if (!tag) {
      console.error(`No tag found. Tag id:`, tagId);
      return;
    }

    return this._db.settings.getAlias(tag.id) || tag.title;
  }

  get raw() {
    return this._collection.getRaw();
  }

  get all() {
    return this._collection.getItems((item) => {
      item.alias = this._db.settings.getAlias(item.id) || item.title;
      return item;
    });
  }

  async remove(tagId) {
    let tag = this.tag(tagId);
    if (!tag) {
      console.error(`No tag found. Tag id:`, tagId);
      return;
    }

    for (let noteId of tag.noteIds) {
      const note = this._db.notes.note(noteId);
      if (!note) continue;
      if (hasItem(note.tags, tag.title)) await note.untag(tag.title);
    }

    await this._db.settings.unpin(tagId);
    await this._collection.deleteItem(tagId);
  }

  async untag(tagId, ...noteIds) {
    let tag = this.tag(tagId);
    if (!tag) {
      console.error(`No such tag found. Tag title:`, tagId);
      return;
    }

    deleteItems(tag.noteIds, ...noteIds);

    if (tag.noteIds.length > 0) await this._collection.addItem(tag);
    else {
      await this._db.settings.unpin(tag.id);
      await this._collection.deleteItem(tag.id);
    }
  }

  sanitize(tag) {
    if (!tag) return;
    let sanitized = tag.toLocaleLowerCase();
    sanitized = sanitized.replace(/[\s]+/g, "");
    // sanitized = sanitized.replace(/[+!@#$%^&*()+{}\][:;'"<>?/.\s=,]+/g, "");
    return sanitized.trim();
  }
}
