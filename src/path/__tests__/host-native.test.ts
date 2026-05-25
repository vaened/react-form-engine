import type { ArrayPath, FieldPath, HostNativeObject, NodePath, Path, PathValue } from "../../index";
import type { Equal, Expect, Extends } from "./type-assertions";

type HostValues = {
  createdAt: Date;
  avatar: File;
  files: FileList;
  payload: Blob;
  nested: {
    uploadedAt: Date;
    attachment?: File;
  };
};

type HostExpectedPath =
  | "createdAt"
  | "avatar"
  | "files"
  | "payload"
  | "nested"
  | "nested.uploadedAt"
  | "nested.attachment";
type HostExpectedFieldPath = "createdAt" | "avatar" | "files" | "payload" | "nested.uploadedAt" | "nested.attachment";
type HostExpectedNodePath = "nested";
type HostExpectedArrayPath = never;

type HostPathExpectationA = Expect<Extends<Path<HostValues>, HostExpectedPath>>;
type HostPathExpectationB = Expect<Extends<HostExpectedPath, Path<HostValues>>>;
type HostFieldPathExpectationA = Expect<Extends<FieldPath<HostValues>, HostExpectedFieldPath>>;
type HostFieldPathExpectationB = Expect<Extends<HostExpectedFieldPath, FieldPath<HostValues>>>;
type HostNodePathExpectationA = Expect<Extends<NodePath<HostValues>, HostExpectedNodePath>>;
type HostNodePathExpectationB = Expect<Extends<HostExpectedNodePath, NodePath<HostValues>>>;
type HostArrayPathExpectation = Expect<Extends<ArrayPath<HostValues>, HostExpectedArrayPath>>;

type CreatedAtValueExpectation = Expect<Equal<PathValue<HostValues, "createdAt">, Date>>;
type AvatarValueExpectation = Expect<Equal<PathValue<HostValues, "avatar">, File>>;
type FilesValueExpectation = Expect<Equal<PathValue<HostValues, "files">, FileList>>;
type PayloadValueExpectation = Expect<Equal<PathValue<HostValues, "payload">, Blob>>;
type NestedUploadedAtValueExpectation = Expect<Equal<PathValue<HostValues, "nested.uploadedAt">, Date>>;
type NestedAttachmentValueExpectation = Expect<Equal<PathValue<HostValues, "nested.attachment">, File | undefined>>;

type HostNativeObjectExpectation = Expect<Extends<Date | File | FileList | Blob, HostNativeObject>>;

declare const hostPathExpectationA: HostPathExpectationA;
declare const hostPathExpectationB: HostPathExpectationB;
declare const hostFieldPathExpectationA: HostFieldPathExpectationA;
declare const hostFieldPathExpectationB: HostFieldPathExpectationB;
declare const hostNodePathExpectationA: HostNodePathExpectationA;
declare const hostNodePathExpectationB: HostNodePathExpectationB;
declare const hostArrayPathExpectation: HostArrayPathExpectation;
declare const createdAtValueExpectation: CreatedAtValueExpectation;
declare const avatarValueExpectation: AvatarValueExpectation;
declare const filesValueExpectation: FilesValueExpectation;
declare const payloadValueExpectation: PayloadValueExpectation;
declare const nestedUploadedAtValueExpectation: NestedUploadedAtValueExpectation;
declare const nestedAttachmentValueExpectation: NestedAttachmentValueExpectation;
declare const hostNativeObjectExpectation: HostNativeObjectExpectation;

void hostPathExpectationA;
void hostPathExpectationB;
void hostFieldPathExpectationA;
void hostFieldPathExpectationB;
void hostNodePathExpectationA;
void hostNodePathExpectationB;
void hostArrayPathExpectation;
void createdAtValueExpectation;
void avatarValueExpectation;
void filesValueExpectation;
void payloadValueExpectation;
void nestedUploadedAtValueExpectation;
void nestedAttachmentValueExpectation;
void hostNativeObjectExpectation;

// @ts-expect-error host native object must stay terminal
const invalidDateFieldPath: FieldPath<HostValues> = "createdAt.getTime";

// @ts-expect-error host native object must stay terminal
const invalidFileFieldPath: FieldPath<HostValues> = "avatar.name";

// @ts-expect-error host native object must stay terminal
const invalidFileListFieldPath: FieldPath<HostValues> = "files.0";

// @ts-expect-error host native object must not become array path
const invalidFileListArrayPath: ArrayPath<HostValues> = "files";

void invalidDateFieldPath;
void invalidFileFieldPath;
void invalidFileListFieldPath;
void invalidFileListArrayPath;
