# Developer Command Center — Implementation Plan

## 0. Architectural North Star

Build this as a **local-first, E2E-encrypted MERN ecosystem** where the cloud backend indexes, syncs, routes, and coordinates, but the **local daemon owns privileged OS operations**: terminal history, global hotkeys, file writes, Git hooks, SSH keys, `.env` vault decryption, and remote server sessions.

The critical design rule:

> **MongoDB may store encrypted secrets, snapshots, canvas state, embeddings, and metadata, but it must never receive raw `.env` values, SSH private keys, FTP passwords, or decrypted vault contents.**

Mongoose discriminators are a good fit for polymorphic artifacts because they let multiple document types share one collection while preserving type-specific schemas. MongoDB Atlas Vector Search is appropriate for semantic retrieval over embedding fields, and MongoDB Change Streams can drive real-time fan-out to clients and daemons. ([Mongoose][1])

---

# 1. System Architecture Design

## 1.1 High-Level Component Diagram

```mermaid
flowchart LR
  subgraph UserDevice["Developer Machine"]
    ReactUI["React Frontend<br/>Browser / Desktop Shell"]
    LocalDaemon["Node Local Daemon<br/>CLI + OS Bridge"]
    LocalDB[("Local SQLite / LMDB Cache<br/>Mutation Queue + Vault Cache")]
    OS["OS APIs<br/>Shell History, Filesystem, Git, Keychain"]
    RemoteA["Remote Servers<br/>SSH / SFTP / FTP"]
  end

  subgraph Cloud["Cloud Backend"]
    API["Node.js + Express API<br/>REST / GraphQL"]
    WS["Socket.IO Gateway<br/>Realtime Events"]
    Workers["Worker Pool<br/>AST, Embeddings, OCR, Snapshots"]
    Redis[("Redis<br/>Queues, Locks, Presence")]
    Mongo[("MongoDB Atlas<br/>Artifacts, Versions, Search, Vectors")]
  end

  ReactUI <-->|HTTPS REST/GraphQL| API
  ReactUI <-->|Socket.IO| WS
  ReactUI <-->|localhost mTLS/WebSocket| LocalDaemon

  LocalDaemon <-->|Sync Protocol<br/>HTTPS + WebSocket| API
  LocalDaemon <-->|Realtime| WS
  LocalDaemon <--> LocalDB
  LocalDaemon <--> OS
  LocalDaemon <-->|Preferred E2E Mode| RemoteA

  API <--> Mongo
  API <--> Redis
  WS <--> Redis
  Workers <--> Redis
  Workers <--> Mongo

  API -. "Optional ephemeral connector mode" .-> RemoteA
```

Socket.IO fits the realtime layer because it provides low-latency, bidirectional, event-based communication between client and server. For horizontally scaled realtime delivery, pair it with Redis-backed presence, locks, queueing, and pub/sub. ([Socket.IO][2])

---

## 1.2 Component Responsibilities

### React Frontend

Primary responsibilities:

1. Artifact CRUD UI.
2. Markdown/snippet editor.
3. Monaco-based code editor.
4. Excalidraw or React Flow canvas.
5. Remote file browser and diff editor.
6. Search UI: lexical, vector, terminal history, server files.
7. Vault UI that only handles encrypted envelopes or local daemon-mediated plaintext.

Recommended frontend stack:

```txt
React + TypeScript
Vite or Next.js SPA mode
TanStack Query for server state
Zustand or Jotai for ephemeral UI state
Monaco Editor for code and remote files
React Flow for structured node graphs
@excalidraw/excalidraw for freeform developer canvas
Yjs or Automerge for collaborative/local-first canvas and notes
Socket.IO client for realtime bridge
```

React Flow is suitable for graph-like developer canvases because it already provides nodes, edges, panning, zooming, selection, and custom node support. Excalidraw is suitable for freeform sketches and whiteboard-style diagrams, and its npm package is designed to be embedded as a React component. ([React Flow][3])

---

### Node/Express Cloud Server

Primary responsibilities:

1. Authentication and authorization.
2. Artifact CRUD API.
3. Search API.
4. Sync API for local daemon.
5. WebSocket fan-out.
6. Background job scheduling.
7. Optional ephemeral remote connector mode.
8. Metadata indexing and version tracking.
9. AI integrations and embedding generation.
10. Audit logging.

Recommended backend stack:

```txt
Node.js + TypeScript
Express
Mongoose
Zod for runtime validation
Passport/Auth.js/custom JWT auth
Socket.IO
BullMQ + Redis
MongoDB Atlas Search + Vector Search
OpenTelemetry
Pino structured logging
Rate limiting via Redis
```

BullMQ is a Redis-backed queue system for Node.js and is appropriate for AST indexing, embedding generation, OCR jobs, remote snapshotting, and retryable sync work. ([BullMQ][4])

---

### Node Local CLI / Daemon

Primary responsibilities:

1. Global hotkey registration.
2. Terminal history capture.
3. `.env` vault pull/push.
4. Local file scaffold generation.
5. Git-aware workspace detection.
6. Local encrypted cache.
7. SSH/SFTP/FTP execution in strict E2E mode.
8. OS keychain integration.
9. Background sync queue.

Recommended daemon stack:

```txt
Node.js + TypeScript
commander or oclif for CLI commands
node-pty for terminal integrations
chokidar for filesystem watchers
better-sqlite3 or LMDB for local durable cache
keytar for OS keychain
simple-git or isomorphic-git
ssh2 / ssh2-sftp-client
basic-ftp
libsodium-wrappers-sumo
Yjs / Automerge
```

The `ssh2` package provides SSH2 client/server modules for Node.js, and `ssh2-sftp-client` wraps SSH2 with a promise-based SFTP client. These are better defaults than shelling out to `ssh`, because credentials, timeouts, fingerprints, streams, and command arguments can be controlled directly in code. ([npm][5])

---

## 1.3 Preferred Deployment Topology

```mermaid
flowchart TD
  A["Browser UI"] --> B["Cloud API"]
  A --> C["Local Daemon on localhost"]
  C --> D["Local Cache"]
  C --> E["OS Keychain"]
  C --> F["Shell / Git / Filesystem"]
  C --> G["Remote SSH/SFTP/FTP"]

  B --> H["MongoDB"]
  B --> I["Redis"]
  B --> J["Workers"]

  J --> H
  J --> I
```

Use **two execution modes**:

### Mode A — Strict E2E Mode, recommended default

Remote operations are performed by the local daemon. The cloud sees metadata, encrypted snapshots, sync events, and audit records, but never decrypted credentials.

Good for:

```txt
Solo developers
Security-conscious teams
SSH key management
.env vaults
Production server editing
```

### Mode B — Ephemeral Cloud Connector Mode, optional

The user explicitly grants a short-lived session key. A cloud worker decrypts credentials in memory only, connects to remote servers, streams results, then destroys the session. This is not pure E2E because the cloud process temporarily sees plaintext.

Good for:

```txt
Team remote pair sessions
Headless browser access
CI-triggered diagnostics
Scheduled remote checks
```

This mode must be opt-in, audited, time-limited, and disabled by default.

---

## 1.4 Data Flow: Quick Capture From Terminal

```mermaid
sequenceDiagram
  participant Shell
  participant CLI as Local CLI/Daemon
  participant LDB as Local Cache
  participant API as Express API
  participant Mongo
  participant UI as React UI

  Shell->>CLI: echo logs | dcc capture --type log
  CLI->>CLI: redact secrets + detect language/context
  CLI->>LDB: append local mutation
  CLI->>API: sync mutation when online
  API->>Mongo: create Artifact
  Mongo-->>API: persisted
  API-->>UI: Socket event artifact.created
  UI-->>UI: update workspace view
```

---

## 1.5 Data Flow: Remote File Watch & Version

```mermaid
sequenceDiagram
  participant UI as React Editor
  participant Daemon as Local Daemon
  participant Remote as Remote Server
  participant API as Express API
  participant Mongo as MongoDB

  UI->>Daemon: open remote file connectionId,path
  Daemon->>Remote: SFTP read file
  Remote-->>Daemon: file content + stat
  Daemon->>API: upload encrypted baseline snapshot metadata
  API->>Mongo: store FileSnapshot v1

  UI->>Daemon: save edited file
  Daemon->>Remote: re-stat file before write
  alt remote file changed
    Daemon-->>UI: conflict with diff
  else unchanged
    Daemon->>API: store encrypted pre-save snapshot
    API->>Mongo: FileSnapshot v2
    Daemon->>Remote: atomic upload temp + rename
    Daemon->>API: save audit event
  end
```

---

# 2. Recommended Libraries by Capability

## 2.1 AST Parsing and Code Intelligence

Use a **parser registry** instead of one universal parser.

```ts
type ParserId =
  | "babel-js-ts"
  | "typescript-ts-morph"
  | "tree-sitter"
  | "prisma-schema"
  | "sql-parser"
  | "markdown-mdast";
```

Recommended tools:

```txt
JavaScript / TypeScript:
  @babel/parser
  @babel/traverse
  ts-morph
  @typescript-eslint/typescript-estree

Multi-language lightweight AST:
  tree-sitter + language grammars

Markdown:
  unified
  remark-parse
  mdast-util-to-string

SQL:
  node-sql-parser
  pg-query-parser for PostgreSQL-specific parsing

Prisma:
  @prisma/internals or Prisma schema parser wrappers

ER diagrams:
  Mermaid ER syntax
  React Flow graph layout
  elkjs / dagre for layout
```

Babel parser generates ASTs for JavaScript/TypeScript-style syntax, and Tree-sitter is widely used for multi-language incremental parsing. For this product, Tree-sitter should power broad language detection and symbol extraction, while Babel/TypeScript-specific parsers should power deeper JS/TS indexing. ([Babel][6])

---

## 2.2 Local-First Sync

Use a hybrid model:

```txt
Metadata:
  Server-authoritative mutation log with idempotent operations.

Canvas / collaborative docs:
  Yjs or Automerge CRDT updates.

Secrets:
  Encrypted envelopes only; no merge of plaintext secrets server-side.

Remote file snapshots:
  Append-only versions with conflict checks.

Terminal history:
  Append-only immutable events.
```

Yjs is a CRDT framework with shared data types that sync automatically and merge concurrent changes without traditional conflict resolution. Automerge is also a strong option for local-first JSON-like documents with offline editing and later sync. ([Yjs Docs][7])

Recommended decision:

```txt
Use Yjs for:
  collaborative editors
  canvas state
  shared markdown docs
  presence

Use server mutation log for:
  artifacts
  workspaces
  remote file metadata
  terminal history
  links
  search index jobs
```

---

## 2.3 Search

Search should be layered:

```txt
Layer 1: MongoDB indexed metadata
Layer 2: Atlas Search lexical search
Layer 3: Atlas Vector Search semantic search
Layer 4: Local daemon search over offline cache
Layer 5: Remote server search through SSH/SFTP workers
Layer 6: Terminal history search from normalized commands
```

Important privacy note:

> Semantic embeddings can leak information about source text. For E2E workspaces, generate embeddings locally and either keep them local-only or mark semantic cloud search as opt-in.

---

# 3. Database Schema Design

The schema should be optimized around **artifacts**, **versions**, **links**, **search chunks**, **devices**, **encrypted vault envelopes**, and **sync mutations**.

## 3.1 Mongoose Schema Overview

```mermaid
erDiagram
  User ||--o{ Device : owns
  User ||--o{ Workspace : owns
  Workspace ||--o{ Artifact : contains
  Artifact ||--o{ ArtifactVersion : versions
  Artifact ||--o{ ArtifactLink : source
  Artifact ||--o{ EmbeddingChunk : indexed_by
  Artifact ||--o{ FileSnapshot : snapshots
  Device ||--o{ SyncMutation : emits
  Workspace ||--o{ RemoteConnection : has
  RemoteConnection ||--o{ FileSnapshot : produces
```

---

## 3.2 Core Schemas

```ts
import mongoose, { Schema, Types } from "mongoose";

const ObjectId = Schema.Types.ObjectId;

/**
 * Stored in MongoDB for E2E payloads.
 * ciphertext is the only payload for secrets.
 * MongoDB never receives plaintext secret values.
 */
const EncryptedEnvelopeSchema = new Schema(
  {
    version: { type: Number, required: true, default: 1 },

    // Example: "xchacha20poly1305-ietf" or "aes-256-gcm"
    alg: { type: String, required: true },

    // Example: "argon2id", "scrypt", "none-device-key"
    kdf: {
      name: { type: String },
      params: { type: Schema.Types.Mixed },
      salt: { type: String },
    },

    nonce: { type: String, required: true },
    ciphertext: { type: String, required: true },
    tag: { type: String },

    aad: { type: String },

    /**
     * Per-device or per-user wrapped data encryption keys.
     * The backend stores these but cannot unwrap them.
     */
    wrappedKeys: [
      {
        recipientType: {
          type: String,
          enum: ["device", "user", "team"],
          required: true,
        },
        recipientId: { type: ObjectId, required: true },
        wrapAlg: { type: String, required: true },
        nonce: { type: String },
        wrappedKey: { type: String, required: true },
      },
    ],

    keyVersion: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const DeviceSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },

    name: { type: String, required: true },
    platform: {
      type: String,
      enum: ["darwin", "linux", "win32", "browser", "unknown"],
      default: "unknown",
    },

    publicEncryptionKey: { type: String, required: true },
    publicSigningKey: { type: String, required: true },

    trustStatus: {
      type: String,
      enum: ["pending", "trusted", "revoked"],
      default: "pending",
      index: true,
    },

    lastSeenAt: { type: Date },
    daemonVersion: { type: String },
  },
  { timestamps: true }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    displayName: { type: String },

    /**
     * Authentication password hash only.
     * Never store reversible login passwords.
     */
    passwordHash: { type: String },

    /**
     * Encrypted account root key, wrapped by passphrase-derived KEK.
     */
    encryptedAccountRootKey: EncryptedEnvelopeSchema,

    plan: {
      type: String,
      enum: ["free", "pro", "team", "enterprise"],
      default: "free",
    },
  },
  { timestamps: true }
);

const WorkspaceSchema = new Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },

    name: { type: String, required: true },
    slug: { type: String, required: true },

    git: {
      remoteUrlHash: { type: String, index: true },
      defaultBranch: { type: String },
      repoRootHint: { type: String },
    },

    privacyMode: {
      type: String,
      enum: ["standard", "e2e", "local-only"],
      default: "standard",
      index: true,
    },

    settings: {
      vectorSearchEnabled: { type: Boolean, default: false },
      cloudAstIndexingEnabled: { type: Boolean, default: true },
      remoteConnectorMode: {
        type: String,
        enum: ["local-daemon-only", "ephemeral-cloud-allowed"],
        default: "local-daemon-only",
      },
    },
  },
  { timestamps: true }
);
```

---

## 3.3 Artifact Base Schema With Discriminators

```ts
const ArtifactBaseSchema = new Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    workspaceId: {
      type: ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    kind: {
      type: String,
      required: true,
      enum: [
        "snippet",
        "markdown",
        "canvas",
        "credential",
        "remoteConnection",
        "terminalEvent",
        "image",
        "remoteFile",
        "astIndex",
      ],
      index: true,
    },

    title: { type: String, required: true },
    slug: { type: String },
    tags: [{ type: String, index: true }],

    visibility: {
      type: String,
      enum: ["private", "workspace", "team"],
      default: "private",
    },

    /**
     * For non-sensitive artifacts, content may be plaintext.
     * For E2E artifacts, contentEnvelope must be used.
     */
    contentText: { type: String },
    contentEnvelope: EncryptedEnvelopeSchema,

    contentHash: { type: String, index: true },
    language: { type: String, index: true },

    source: {
      type: {
        type: String,
        enum: [
          "manual",
          "cli",
          "terminal",
          "git",
          "remote",
          "ocr",
          "import",
          "ai",
        ],
        default: "manual",
      },
      deviceId: { type: ObjectId, ref: "Device" },
      path: { type: String },
      cwdHash: { type: String },
      gitCommit: { type: String },
      gitBranch: { type: String },
      remoteConnectionId: { type: ObjectId },
    },

    ast: {
      parser: { type: String },
      parserVersion: { type: String },
      status: {
        type: String,
        enum: ["none", "queued", "parsed", "failed"],
        default: "none",
      },
      symbols: [
        {
          name: String,
          kind: String,
          loc: {
            startLine: Number,
            startCol: Number,
            endLine: Number,
            endCol: Number,
          },
        },
      ],
      imports: [String],
      exports: [String],
      errors: [String],
      astHash: String,
    },

    search: {
      lexicalIndexedAt: Date,
      vectorIndexedAt: Date,
      vectorStatus: {
        type: String,
        enum: ["disabled", "queued", "indexed", "failed"],
        default: "disabled",
      },
      privacyClass: {
        type: String,
        enum: ["plain", "sensitive", "e2e"],
        default: "plain",
      },
    },

    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    discriminatorKey: "kind",
    minimize: false,
  }
);

ArtifactBaseSchema.index({ ownerId: 1, workspaceId: 1, kind: 1, updatedAt: -1 });
ArtifactBaseSchema.index({ ownerId: 1, tags: 1 });
ArtifactBaseSchema.index({ title: "text", contentText: "text", tags: "text" });

export const Artifact = mongoose.model("Artifact", ArtifactBaseSchema);
```

---

## 3.4 Snippet Artifact

```ts
const SnippetArtifactSchema = new Schema({
  language: { type: String, required: true, index: true },

  snippetType: {
    type: String,
    enum: ["function", "component", "config", "command", "error", "note"],
    default: "note",
    index: true,
  },

  codeMeta: {
    framework: String,
    packageManager: String,
    runtime: String,
    detectedSecrets: [{ type: String }],
    safeToIndex: { type: Boolean, default: true },
  },

  executionHints: {
    command: String,
    args: [String],
    envKeys: [String],
    requiresConfirmation: { type: Boolean, default: true },
  },
});

export const SnippetArtifact = Artifact.discriminator(
  "snippet",
  SnippetArtifactSchema
);
```

---

## 3.5 Canvas Artifact

```ts
const CanvasArtifactSchema = new Schema({
  engine: {
    type: String,
    enum: ["excalidraw", "react-flow", "hybrid"],
    required: true,
  },

  /**
   * Canonical rendered state for fast loading.
   * For collaborative/offline editing, use crdtState as source of truth.
   */
  canvasJson: { type: Schema.Types.Mixed },

  crdt: {
    provider: {
      type: String,
      enum: ["none", "yjs", "automerge"],
      default: "yjs",
    },
    snapshot: Buffer,
    stateVector: Buffer,
    updateCount: { type: Number, default: 0 },
    compactedAt: Date,
  },

  layout: {
    viewport: {
      x: Number,
      y: Number,
      zoom: Number,
    },
    bounds: {
      width: Number,
      height: Number,
    },
  },
});

export const CanvasArtifact = Artifact.discriminator(
  "canvas",
  CanvasArtifactSchema
);
```

---

## 3.6 Credential / Vault Artifact

```ts
const CredentialArtifactSchema = new Schema({
  vaultType: {
    type: String,
    enum: ["env", "ssh-key", "ftp-password", "api-token", "generic"],
    required: true,
    index: true,
  },

  /**
   * Only non-secret routing metadata.
   */
  publicMeta: {
    host: String,
    port: Number,
    usernameHint: String,
    protocol: {
      type: String,
      enum: ["ssh", "sftp", "ftp", "ftps", "http", "generic"],
    },
    keyName: String,
    envNameHash: String,
    fingerprint: String,
  },

  secretEnvelope: { type: EncryptedEnvelopeSchema, required: true },

  rotation: {
    keyVersion: { type: Number, default: 1 },
    lastRotatedAt: Date,
    expiresAt: Date,
  },
});

export const CredentialArtifact = Artifact.discriminator(
  "credential",
  CredentialArtifactSchema
);
```

---

## 3.7 Remote Connection Artifact

```ts
const RemoteConnectionArtifactSchema = new Schema({
  protocol: {
    type: String,
    enum: ["ssh", "sftp", "ftp", "ftps"],
    required: true,
    index: true,
  },

  host: { type: String, required: true },
  port: { type: Number, required: true },
  usernameHint: { type: String },

  credentialArtifactId: {
    type: ObjectId,
    ref: "Artifact",
    required: true,
    index: true,
  },

  security: {
    knownHostFingerprint: String,
    strictHostKeyChecking: { type: Boolean, default: true },
    allowEphemeralCloudUse: { type: Boolean, default: false },
  },

  defaults: {
    rootPath: String,
    editorMode: {
      type: String,
      enum: ["read-only", "edit-with-snapshot", "direct-edit-disabled"],
      default: "edit-with-snapshot",
    },
  },
});

export const RemoteConnectionArtifact = Artifact.discriminator(
  "remoteConnection",
  RemoteConnectionArtifactSchema
);
```

---

## 3.8 Terminal Event Artifact

```ts
const TerminalEventArtifactSchema = new Schema({
  shell: {
    type: String,
    enum: ["bash", "zsh", "fish", "powershell", "unknown"],
    default: "unknown",
    index: true,
  },

  commandPreview: { type: String },
  commandEnvelope: EncryptedEnvelopeSchema,

  commandHash: { type: String, required: true, index: true },

  cwdHash: { type: String, index: true },
  git: {
    repoHash: String,
    branch: String,
    commit: String,
    dirty: Boolean,
  },

  exitCode: Number,
  durationMs: Number,

  capturedAt: { type: Date, required: true, index: true },

  classification: {
    type: String,
    enum: ["normal", "error", "install", "git", "deploy", "test", "secret-risk"],
    default: "normal",
    index: true,
  },
});

export const TerminalEventArtifact = Artifact.discriminator(
  "terminalEvent",
  TerminalEventArtifactSchema
);
```

---

## 3.9 Versioning and Remote File Snapshots

```ts
const ArtifactVersionSchema = new Schema(
  {
    artifactId: { type: ObjectId, ref: "Artifact", required: true, index: true },
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    workspaceId: { type: ObjectId, ref: "Workspace", required: true, index: true },

    version: { type: Number, required: true },
    parentVersion: { type: Number },

    contentHash: { type: String, required: true },
    diffHash: { type: String },

    snapshotText: String,
    snapshotEnvelope: EncryptedEnvelopeSchema,

    patch: {
      format: {
        type: String,
        enum: ["json-patch", "unified-diff", "binary-delta", "full"],
        default: "full",
      },
      text: String,
      envelope: EncryptedEnvelopeSchema,
    },

    source: {
      type: {
        type: String,
        enum: ["manual", "cli", "remote-pre-save", "remote-post-save", "sync"],
        required: true,
      },
      deviceId: { type: ObjectId, ref: "Device" },
      remoteConnectionId: { type: ObjectId },
      remotePath: String,
    },
  },
  { timestamps: true }
);

ArtifactVersionSchema.index({ artifactId: 1, version: -1 }, { unique: true });

export const ArtifactVersion = mongoose.model(
  "ArtifactVersion",
  ArtifactVersionSchema
);

const FileSnapshotSchema = new Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    workspaceId: { type: ObjectId, ref: "Workspace", required: true, index: true },

    remoteConnectionId: {
      type: ObjectId,
      ref: "Artifact",
      required: true,
      index: true,
    },

    remotePath: { type: String, required: true },
    remotePathHash: { type: String, required: true, index: true },

    version: { type: Number, required: true },

    stat: {
      size: Number,
      mtimeMs: Number,
      mode: Number,
      uid: Number,
      gid: Number,
    },

    contentHash: { type: String, required: true },

    snapshotEnvelope: EncryptedEnvelopeSchema,

    reason: {
      type: String,
      enum: ["open", "pre-save", "post-save", "manual-backup", "watch"],
      required: true,
      index: true,
    },

    createdByDeviceId: { type: ObjectId, ref: "Device" },
  },
  { timestamps: true }
);

FileSnapshotSchema.index(
  { remoteConnectionId: 1, remotePathHash: 1, version: -1 },
  { unique: true }
);

export const FileSnapshot = mongoose.model("FileSnapshot", FileSnapshotSchema);
```

---

## 3.10 Links, Embeddings, and Sync Mutations

```ts
const ArtifactLinkSchema = new Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    workspaceId: { type: ObjectId, ref: "Workspace", required: true, index: true },

    fromArtifactId: { type: ObjectId, ref: "Artifact", required: true, index: true },
    toArtifactId: { type: ObjectId, ref: "Artifact", required: true, index: true },

    relation: {
      type: String,
      enum: [
        "references",
        "explains",
        "generated-from",
        "fixes-error",
        "uses-credential",
        "belongs-to-canvas",
        "similar-to",
      ],
      required: true,
      index: true,
    },

    weight: { type: Number, default: 1 },
    createdBy: { type: String, enum: ["user", "system", "ai"], default: "user" },
  },
  { timestamps: true }
);

ArtifactLinkSchema.index(
  { fromArtifactId: 1, toArtifactId: 1, relation: 1 },
  { unique: true }
);

export const ArtifactLink = mongoose.model("ArtifactLink", ArtifactLinkSchema);

const EmbeddingChunkSchema = new Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    workspaceId: { type: ObjectId, ref: "Workspace", required: true, index: true },
    artifactId: { type: ObjectId, ref: "Artifact", required: true, index: true },

    chunkIndex: { type: Number, required: true },
    textHash: { type: String, required: true },

    /**
     * Store only for non-E2E or explicit opt-in semantic indexing.
     */
    textPreview: String,

    embeddingModel: { type: String, required: true },
    embeddingDimensions: { type: Number, required: true },

    embedding: {
      type: [Number],
      required: true,
      index: false,
    },

    privacyClass: {
      type: String,
      enum: ["plain", "sensitive-opt-in", "local-only"],
      required: true,
    },
  },
  { timestamps: true }
);

EmbeddingChunkSchema.index({ artifactId: 1, chunkIndex: 1 }, { unique: true });

export const EmbeddingChunk = mongoose.model(
  "EmbeddingChunk",
  EmbeddingChunkSchema
);

const SyncMutationSchema = new Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: ObjectId, ref: "Device", required: true, index: true },

    mutationId: { type: String, required: true, unique: true },
    clientSeq: { type: Number, required: true },
    serverSeq: { type: Number, index: true },

    workspaceId: { type: ObjectId, ref: "Workspace", index: true },

    op: {
      type: String,
      enum: [
        "artifact.create",
        "artifact.update",
        "artifact.delete",
        "artifact.link",
        "vault.upsert",
        "canvas.crdtUpdate",
        "remote.snapshot",
        "terminal.capture",
      ],
      required: true,
    },

    payload: { type: Schema.Types.Mixed, required: true },

    status: {
      type: String,
      enum: ["accepted", "rejected", "applied", "conflict"],
      default: "accepted",
      index: true,
    },

    error: {
      code: String,
      message: String,
    },

    hybridLogicalClock: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

SyncMutationSchema.index({ ownerId: 1, deviceId: 1, clientSeq: 1 }, { unique: true });

export const SyncMutation = mongoose.model("SyncMutation", SyncMutationSchema);
```

---

# 4. API and Sync Architecture

## 4.1 API Surface

```txt
/api/auth/*
/api/workspaces
/api/artifacts
/api/artifacts/:id/versions
/api/artifacts/:id/links
/api/search
/api/search/vector
/api/search/hybrid
/api/vault/items
/api/sync/push
/api/sync/pull
/api/devices
/api/remote/connections
/api/remote/sessions
/api/terminal/events
```

## 4.2 WebSocket Events

```txt
client:sync.push
client:daemon.heartbeat
client:remote.open
client:remote.save
client:canvas.update
client:vault.unlock.intent

server:artifact.created
server:artifact.updated
server:artifact.deleted
server:sync.pullAvailable
server:remote.fileChanged
server:job.completed
server:job.failed
server:device.revoked
```

## 4.3 Mutation Envelope

```ts
export type SyncMutationEnvelope = {
  mutationId: string;
  deviceId: string;
  clientSeq: number;
  workspaceId: string;
  op:
    | "artifact.create"
    | "artifact.update"
    | "artifact.delete"
    | "vault.upsert"
    | "canvas.crdtUpdate"
    | "remote.snapshot"
    | "terminal.capture";
  hybridLogicalClock: string;
  payload: unknown;
  signature: string;
};
```

## 4.4 Idempotent Sync Push Handler

```ts
app.post("/api/sync/push", requireAuth, async (req, res) => {
  const mutations = z.array(SyncMutationEnvelopeSchema).parse(req.body.mutations);

  const results = [];

  for (const mutation of mutations) {
    const existing = await SyncMutation.findOne({
      mutationId: mutation.mutationId,
      ownerId: req.user.id,
    });

    if (existing) {
      results.push({
        mutationId: mutation.mutationId,
        status: existing.status,
        serverSeq: existing.serverSeq,
      });
      continue;
    }

    // Verify device trust and mutation signature before applying.
    await verifyTrustedDeviceSignature(req.user.id, mutation);

    const applied = await applyMutationTransaction(req.user.id, mutation);

    results.push(applied);
  }

  res.json({ results });
});
```

---

# 5. Phase-by-Phase Execution Plan

# Phase 1 — Core Foundation

## Goal

Deliver the base MERN application: auth, workspaces, artifact CRUD, basic search, simple markdown/snippet editor, and foundational schema.

## 5.1 Backend Tasks

### 5.1.1 Monorepo Setup

Recommended structure:

```txt
developer-command-center/
  apps/
    web/
    api/
    daemon/
  packages/
    shared/
    crypto/
    sync/
    parsers/
    ui/
  infra/
    docker/
    terraform/
  scripts/
```

Use TypeScript everywhere.

### 5.1.2 Express API Foundation

Implement:

```txt
Auth middleware
Workspace CRUD
Artifact CRUD
Artifact version writes
Input validation with Zod
Mongoose models
Pino request logging
OpenTelemetry traces
Central error handler
```

### 5.1.3 MongoDB Indexes

Create these immediately:

```ts
db.artifacts.createIndex({ ownerId: 1, workspaceId: 1, kind: 1, updatedAt: -1 });
db.artifacts.createIndex({ ownerId: 1, tags: 1 });
db.artifacts.createIndex({ title: "text", contentText: "text", tags: "text" });

db.artifactversions.createIndex({ artifactId: 1, version: -1 }, { unique: true });
db.artifactlinks.createIndex({ fromArtifactId: 1, relation: 1 });
db.syncmutations.createIndex({ ownerId: 1, deviceId: 1, clientSeq: 1 }, { unique: true });
```

### 5.1.4 Auth

Use:

```txt
Email/password or OAuth
Argon2id password hashing
JWT access token + refresh token rotation
Device registration
Session revocation
```

OWASP recommends password hashing rather than reversible password encryption, and its cryptographic storage guidance should drive key handling, encryption boundaries, and rotation procedures. ([OWASP Cheat Sheet Series][8])

### 5.1.5 Background Workers

Add Redis + BullMQ queues:

```txt
artifact.index.lexical
artifact.index.ast
artifact.index.embedding
artifact.ocr
artifact.snapshot.compact
canvas.crdt.compact
```

---

## 5.2 Frontend Tasks

Implement:

```txt
Login/register
Workspace switcher
Artifact list
Snippet editor
Markdown editor
Tag manager
Artifact detail route
Version history route
Simple search route
```

Recommended UI architecture:

```txt
TanStack Query:
  server state

Zustand:
  command palette state
  editor tabs
  search filters
  daemon connection state

Monaco:
  code editor

React Router:
  route management

Socket.IO:
  realtime invalidation
```

---

## 5.3 Acceptance Criteria

Phase 1 is complete when:

```txt
A user can create a workspace.
A user can create snippets and markdown notes.
Artifacts are versioned.
Artifacts can be searched by title/content/tags.
Socket.IO pushes artifact updates to open clients.
Basic auth and device registration are functional.
```

---

# Phase 2 — CLI & Local Daemon Bridge

## Goal

Introduce the local-first engine: CLI capture, daemon sync, local encrypted cache, `.env` vault, terminal rewind, and Git-aware context.

## 5.4 Daemon Architecture

```mermaid
flowchart TD
  CLI["dcc CLI"] --> Daemon["Daemon Process"]
  Daemon --> Router["Command Router"]
  Daemon --> LocalDB["Local SQLite/LMDB"]
  Daemon --> Crypto["Crypto Module"]
  Daemon --> Sync["Sync Engine"]
  Daemon --> OS["OS Adapters"]
  OS --> Shell["Shell History"]
  OS --> Git["Git Repos"]
  OS --> FS["Filesystem"]
  Crypto --> Keychain["OS Keychain"]
  Sync --> Cloud["Cloud API"]
```

## 5.5 CLI Commands

```bash
dcc login
dcc daemon start
dcc daemon status

dcc capture "note text"
dcc capture --stdin --type log
dcc save-history
dcc search "docker compose error"

dcc env pull --workspace api --target .env.local
dcc env push --workspace api --source .env.local
dcc env set STRIPE_SECRET_KEY
dcc env get STRIPE_SECRET_KEY

dcc scaffold --artifact <artifactId> --target ./generated
dcc error remember --stdin
dcc git bind
```

## 5.6 Local Cache

Use local DB tables:

```sql
CREATE TABLE mutations (
  mutation_id TEXT PRIMARY KEY,
  client_seq INTEGER NOT NULL,
  op TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE artifacts_cache (
  artifact_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  encrypted_payload BLOB,
  updated_at TEXT NOT NULL
);

CREATE TABLE vault_cache (
  vault_item_id TEXT PRIMARY KEY,
  encrypted_envelope_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE daemon_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## 5.7 Terminal History Sync

Terminal history is tricky because `.bash_history` and `.zsh_history` are not reliable realtime event streams. Implement three capture strategies:

```txt
Strategy 1:
  Shell integration hook.
  Bash PROMPT_COMMAND, zsh precmd/preexec, fish events.

Strategy 2:
  Periodic history file tailing.
  Track inode, byte offset, shell format, and mtime.

Strategy 3:
  Explicit capture.
  command | dcc capture --stdin
```

Normalize every command:

```ts
type TerminalCommandEvent = {
  shell: "bash" | "zsh" | "fish" | "powershell";
  commandRaw?: string;
  commandEncrypted?: EncryptedEnvelope;
  commandPreview: string;
  commandHash: string;
  cwdHash: string;
  git?: {
    repoHash: string;
    branch: string;
    commit: string;
    dirty: boolean;
  };
  exitCode?: number;
  startedAt?: string;
  endedAt?: string;
};
```

Apply local redaction before storage:

```txt
AWS_SECRET_ACCESS_KEY=...
xoxb-...
ghp_...
-----BEGIN PRIVATE KEY-----
Authorization: Bearer ...
password=
token=
```

---

## 5.8 `.env` Vault

### Pull Flow

```mermaid
sequenceDiagram
  participant CLI
  participant Keychain
  participant API
  participant Mongo
  participant FS as Filesystem

  CLI->>Keychain: load device private key
  CLI->>API: fetch encrypted env vault
  API->>Mongo: read envelopes
  Mongo-->>API: encrypted envelopes
  API-->>CLI: encrypted envelopes
  CLI->>CLI: decrypt locally
  CLI->>FS: write .env.local with safe permissions
```

### Push Flow

```mermaid
sequenceDiagram
  participant CLI
  participant FS as Filesystem
  participant Crypto
  participant API
  participant Mongo

  CLI->>FS: read .env
  CLI->>CLI: parse dotenv
  CLI->>Crypto: encrypt each key/value locally
  CLI->>API: upload encrypted envelopes
  API->>Mongo: store encrypted vault items
```

Store `.env` values per key rather than as one large blob:

```ts
type EnvVaultPayload = {
  keyName: string;
  value: string;
  comment?: string;
  updatedFromPath?: string;
};
```

Then encrypt each payload independently. This supports partial rotation, conflict handling, and selective pull.

---

## 5.9 Acceptance Criteria

Phase 2 is complete when:

```txt
dcc daemon can authenticate and register a trusted device.
CLI can capture stdin into the app.
Terminal history can be imported.
.env values can be pushed encrypted and pulled locally.
Local changes queue offline and sync later.
React UI can show daemon online/offline state.
```

---

# Phase 3 — Cloud & Network Manager

## Goal

Implement SSH/SFTP/FTP connection management, remote file browser, remote editor, pre-save snapshotting, conflict detection, and remote script execution.

## 5.10 Remote Connection Model

Use remote connections as artifacts:

```txt
RemoteConnectionArtifact
  protocol
  host
  port
  credentialArtifactId
  knownHostFingerprint
  strictHostKeyChecking
  rootPath
```

Credentials remain encrypted in `CredentialArtifact`.

---

## 5.11 Remote File Browser

Flow:

```txt
React asks daemon to browse connection.
Daemon decrypts credential locally.
Daemon connects via SFTP/FTP.
Daemon streams directory listing to React.
React renders file tree.
Metadata optionally syncs to cloud.
```

Directory listing shape:

```ts
type RemoteFileEntry = {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink" | "unknown";
  size?: number;
  mtimeMs?: number;
  mode?: number;
  permissions?: string;
  contentHash?: string;
};
```

---

## 5.12 Remote File Editor

Use Monaco for editing and diffing.

Required save protocol:

```txt
1. Read remote stat before editing.
2. Store encrypted baseline snapshot.
3. User edits file.
4. Before save, re-stat remote file.
5. If changed, show 3-way diff.
6. If unchanged, store encrypted pre-save snapshot.
7. Upload to temp path.
8. chmod/chown if needed.
9. Atomic rename temp path to final path.
10. Store post-save snapshot metadata.
```

Never write remote files directly without snapshotting first.

---

## 5.13 Remote Watch & Version

There is no universal remote filesystem watch protocol across SSH/SFTP/FTP. Implement polling with adaptive intervals:

```txt
Hot file open in editor:
  poll every 3–5 seconds

Watched production config:
  poll every 30–60 seconds

Large directory:
  poll metadata only

FTP:
  no reliable atomicity; warn user
```

Snapshot policy:

```txt
Small text files:
  encrypted full snapshot + unified diff

Large text files:
  encrypted compressed snapshot + diff

Binary files:
  hash + optional GridFS encrypted blob

Secrets:
  local-only unless explicitly stored as vault item
```

---

## 5.14 Remote Script Execution

Execution must be allowlisted and argument-based.

Bad:

```ts
exec(`deploy ${branch} ${userInput}`);
```

Good:

```ts
ssh.execCommand("deploy", {
  args: ["--branch", safeBranchName],
  cwd: "/var/www/app",
  timeoutMs: 30_000,
});
```

Node command execution must avoid shell interpolation. OWASP’s Node.js security guidance calls out Node applications as vulnerable to common web issues, and command injection is a known class of Node risk when untrusted input reaches OS execution APIs. Node itself has also had security releases involving command injection edge cases in `child_process.spawn` on Windows, so command execution should be treated as a hardened subsystem, not a helper utility. ([OWASP Cheat Sheet Series][9])

---

## 5.15 Acceptance Criteria

Phase 3 is complete when:

```txt
User can create encrypted SSH/SFTP/FTP connections.
User can browse remote files through daemon.
User can open, edit, diff, and save remote files.
Every save creates an encrypted pre-save snapshot.
Remote conflicts are detected before overwrite.
Remote script execution requires explicit confirmation and allowlisted commands.
```

---

# Phase 4 — Advanced Features & AI

## Goal

Implement semantic search, AST intelligence, auto-ER diagrams, OCR, AI-assisted linking, and context workspaces.

---

## 5.16 AST Auto-Detection

Pipeline:

```mermaid
flowchart TD
  A["Artifact Created/Updated"] --> B["Detect Language"]
  B --> C{"Sensitive?"}
  C -->|E2E/local-only| D["Queue local daemon parse"]
  C -->|Plain| E["Cloud parser worker"]
  D --> F["Extract symbols/imports/errors"]
  E --> F
  F --> G["Store AST summary"]
  G --> H["Create links + search chunks"]
```

AST output should be summarized, not store full AST for every snippet by default:

```ts
type AstSummary = {
  parser: string;
  language: string;
  symbols: Array<{
    name: string;
    kind: "function" | "class" | "component" | "type" | "variable";
    loc: SourceLocation;
  }>;
  imports: string[];
  exports: string[];
  calls?: string[];
  diagnostics?: string[];
};
```

---

## 5.17 Auto-ER Diagram Generation

Input sources:

```txt
Prisma schema
SQL DDL
Database introspection output
Existing markdown tables
```

Pipeline:

```txt
Parse schema
Normalize entities
Extract fields
Extract relations
Build graph
Auto-layout with elkjs/dagre
Render in React Flow
Export Mermaid ER syntax
Store as CanvasArtifact
```

Canonical ER model:

```ts
type EntityModel = {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey?: boolean;
    unique?: boolean;
  }>;
};

type RelationModel = {
  fromEntity: string;
  fromField: string;
  toEntity: string;
  toField: string;
  cardinality: "1:1" | "1:N" | "N:M";
};
```

---

## 5.18 Vector Search

Hybrid search request:

```ts
type HybridSearchRequest = {
  query: string;
  workspaceIds?: string[];
  kinds?: string[];
  tags?: string[];
  language?: string;
  includeTerminalHistory?: boolean;
  includeRemoteFiles?: boolean;
  semantic?: boolean;
  lexical?: boolean;
  limit?: number;
};
```

Search strategy:

```txt
1. Run lexical search over title/content/tags.
2. Run vector search over embedding chunks.
3. Merge by reciprocal rank fusion.
4. Boost current Git workspace.
5. Boost recent terminal context.
6. Apply permission and privacy filters.
7. Return artifacts + explanation.
```

Important privacy rule:

```txt
privacyClass=e2e:
  cloud vector indexing disabled

privacyClass=sensitive-opt-in:
  embedding generated locally
  vector uploaded only after explicit user consent

privacyClass=plain:
  cloud worker may generate embedding
```

---

## 5.19 Image OCR

OCR pipeline:

```txt
Image upload
Local/client-side OCR for E2E workspace
Cloud OCR worker for plain workspace
Extract text
Create artifact text chunks
Optionally embed
Link image artifact to extracted notes
```

---

## 5.20 Acceptance Criteria

Phase 4 is complete when:

```txt
Snippets auto-detect language and symbols.
Prisma/SQL can generate ER canvas.
Hybrid search returns lexical + semantic results.
E2E workspaces do not leak plaintext to cloud AI workers.
Image OCR produces searchable extracted text.
Canvas can link snippets, remote files, terminal events, and docs.
```

---

# 6. Security Protocol

## 6.1 E2E Encryption Model

Use envelope encryption.

```mermaid
flowchart TD
  Secret["Plaintext Secret<br/>.env / SSH key / FTP password"] --> DEK["Random Data Encryption Key"]
  DEK --> AEAD["Encrypt secret with AEAD"]
  AEAD --> Envelope["Encrypted Envelope in MongoDB"]

  DevicePub["Trusted Device Public Key"] --> Wrap["Wrap DEK per device"]
  DEK --> Wrap
  Wrap --> Envelope

  PrivateKey["Device Private Key<br/>OS Keychain"] --> Unwrap["Unwrap DEK locally"]
  Envelope --> Unwrap
  Unwrap --> Decrypt["Decrypt secret locally"]
```

Recommended primitives:

```txt
Payload encryption:
  XChaCha20-Poly1305 via libsodium
  or AES-256-GCM via WebCrypto/Node crypto

Key derivation:
  Argon2id for passphrase-derived keys
  scrypt fallback where Argon2id is unavailable

Device key wrapping:
  X25519 public-key boxes / sealed boxes
  per-device wrapped DEKs

Integrity:
  AEAD additional authenticated data includes:
    userId
    workspaceId
    artifactId
    vaultType
    keyVersion
```

Libsodium sealed boxes are designed so only the recipient can decrypt messages using their private key, with an ephemeral key pair erased after encryption. This maps well to per-device secret sharing. ([Libsodium Documentation][10])

---

## 6.2 Vault Encryption Steps

### Device Registration

```txt
1. Daemon generates encryption keypair.
2. Daemon generates signing keypair.
3. Private keys stored in OS keychain.
4. Public keys uploaded to Device document.
5. Existing trusted device approves new device.
6. Account root key is wrapped for the new device.
```

### Secret Write

```txt
1. User enters/imports secret locally.
2. Client/daemon generates random DEK.
3. Secret payload encrypted with DEK.
4. DEK wrapped for all trusted devices.
5. Encrypted envelope sent to Express.
6. Express validates envelope shape only.
7. MongoDB stores envelope.
```

### Secret Read

```txt
1. Client fetches encrypted envelope.
2. Local daemon retrieves private key from OS keychain.
3. Daemon unwraps DEK.
4. Daemon decrypts secret locally.
5. Secret is returned only to approved local process/UI session.
```

---

## 6.3 `.env` Security Rules

```txt
Never upload raw .env files.
Never log env values.
Encrypt values per key.
Optionally HMAC env key names for high-security mode.
Redact known secret patterns before terminal capture.
Require explicit confirmation before writing .env to disk.
Write files with restrictive permissions.
Keep decrypted env values in memory only.
Expire unlock sessions.
```

Recommended `.env` envelope payload before encryption:

```json
{
  "key": "DATABASE_URL",
  "value": "postgres://...",
  "comment": "local dev database",
  "source": ".env.local",
  "updatedAt": "2026-07-03T00:00:00.000Z"
}
```

---

## 6.4 SSH Key Security Rules

```txt
Never store raw private keys in MongoDB.
Private key material must be encrypted before API upload.
Known host fingerprint is stored as plaintext metadata.
Strict host key checking is enabled by default.
SSH passphrases are vault items, also encrypted.
Remote command execution requires explicit user intent.
No remote command interpolation.
No agent forwarding by default.
No password auth by default for production profiles.
```

---

## 6.5 AST Parsing Safety

AST parsing should be treated as untrusted-code processing.

Rules:

```txt
Never eval parsed code.
Never import user code.
Never execute package scripts.
Parse in worker_threads or child processes.
Apply max file size limits.
Apply CPU timeout.
Apply memory limit.
Strip source maps unless explicitly needed.
Store AST summaries, not full AST blobs, by default.
Disable cloud parsing for E2E workspaces unless user opts in.
```

Example parser worker boundary:

```ts
import { Worker } from "node:worker_threads";

export async function parseSafely(input: {
  code: string;
  language: string;
  maxBytes: number;
}) {
  if (Buffer.byteLength(input.code, "utf8") > input.maxBytes) {
    throw new Error("File too large for AST parsing");
  }

  return runWorkerWithTimeout({
    workerPath: require.resolve("./parser-worker.js"),
    workerData: input,
    timeoutMs: 5_000,
    memoryMb: 128,
  });
}
```

---

## 6.6 Remote Execution Safety

Rules:

```txt
Use spawn/execFile-style argument arrays locally.
For SSH, send command and args through a controlled builder.
Reject shell metacharacters unless command profile explicitly permits them.
Default to read-only remote sessions.
Require confirmation for destructive commands.
Set timeouts.
Bound stdout/stderr.
Store command audit logs.
Redact output before cloud sync.
```

---

# 7. Performance Protocol

## 7.1 Latency Budget

```txt
Artifact list load:
  < 200 ms from cache
  < 700 ms cold API

Quick capture:
  < 50 ms local append
  sync async

Search:
  < 300 ms lexical
  < 800 ms hybrid semantic

Remote file open:
  depends on network
  stream file metadata first
  lazy-load content

Canvas load:
  load compacted snapshot first
  replay CRDT updates after paint
```

## 7.2 MongoDB Performance

Use:

```txt
Compound indexes by ownerId/workspaceId/kind.
Separate EmbeddingChunk collection.
Separate FileSnapshot collection.
TTL indexes for ephemeral remote sessions.
Partial indexes for deletedAt: null.
Change Streams for realtime invalidation.
```

MongoDB Change Streams let applications subscribe to data changes and produce reactive events, which makes them appropriate for invalidating frontend caches and notifying local daemons. ([MongoDB][11])

## 7.3 Worker Performance

Use dedicated queues:

```txt
ast.queue:
  concurrency high
  CPU-bound
  worker_threads

embedding.queue:
  concurrency limited
  rate-limited by provider/local model

ocr.queue:
  CPU-heavy
  lower priority

remote.snapshot.queue:
  IO-bound
  retryable
```

## 7.4 Canvas Performance

Rules:

```txt
Do not store every drag event as a full MongoDB document.
Use CRDT update batches.
Compact CRDT state periodically.
Store rendered thumbnail separately.
Virtualize large canvas object lists.
Use React Flow for structured graphs and Excalidraw for freeform sketches.
```

## 7.5 Search Performance

Use reciprocal rank fusion:

```ts
score =
  lexicalRankWeight / (k + lexicalRank)
  + vectorRankWeight / (k + vectorRank)
  + recencyBoost
  + workspaceBoost
  + gitContextBoost;
```

---

# 8. Key Technical Roadblocks & Solutions

## Roadblock 1 — E2E Encryption vs Cloud Remote Manager

### Problem

Cloud-side SSH/FTP requires decrypted credentials, but true E2E encryption means the cloud must not decrypt credentials.

### Solution

Use a two-mode model:

```txt
Default:
  Local daemon performs SSH/SFTP/FTP.
  Cloud only stores encrypted credentials and encrypted snapshots.

Optional:
  Ephemeral cloud connector.
  User explicitly grants temporary session access.
  Credential decrypted only in short-lived worker memory.
  Full audit trail.
  Disabled for high-security workspaces.
```

### Implementation Guardrails

```txt
Workspace setting: remoteConnectorMode
Credential flag: allowEphemeralCloudUse
Session TTL: 5–30 minutes
Worker memory zeroization best effort
No persistent logs containing secrets
Mandatory audit event
```

---

## Roadblock 2 — Terminal History Sync Reliability

### Problem

Shell history files are inconsistent:

```txt
Bash may write on shell exit.
Zsh has timestamps only with extended history.
Fish uses a different format.
PowerShell uses PSReadLine history.
Commands may include secrets.
```

### Solution

Use layered capture:

```txt
1. Shell hook for realtime events.
2. History file tailer as fallback.
3. Explicit pipe capture.
4. Secret redaction before persistence.
5. Command hashing for deduplication.
6. User-controlled ignore patterns.
```

Deduplication key:

```ts
const commandIdentity = sha256(
  [
    normalizedCommand,
    cwdHash,
    gitRepoHash,
    Math.floor(timestampMs / 1000),
  ].join("\0")
);
```

---

## Roadblock 3 — Offline-First Sync With Complex Canvas JSON

### Problem

Canvas state is large, frequently mutated, and prone to conflicts. Saving full JSON snapshots on every update will create latency, write amplification, and merge conflicts.

### Solution

Use CRDT updates for canvas internals and server-authoritative metadata outside the canvas.

```txt
Canvas elements:
  Yjs/Automerge CRDT updates

Artifact metadata:
  server mutation log

Snapshots:
  compacted periodically

Conflict model:
  CRDT for objects
  explicit conflict UI for title/tags/settings
```

Yjs and Automerge are designed for local-first/collaborative data where replicas can edit independently and later converge, making them a better fit than naive last-write-wins JSON saves for the canvas layer. ([Yjs Docs][7])

---

# 9. Concrete MVP Build Order

## Week 1–2: Foundation

```txt
Set up monorepo.
Create Express API.
Create MongoDB schemas.
Implement auth.
Implement workspace CRUD.
Implement artifact CRUD.
Implement artifact versions.
Create React shell.
```

## Week 3–4: Core UX

```txt
Artifact list/detail.
Snippet editor.
Markdown editor.
Tagging.
Basic search.
Socket.IO updates.
Worker queue skeleton.
```

## Week 5–6: Daemon MVP

```txt
CLI login.
Device registration.
Local cache.
Mutation queue.
dcc capture.
dcc save-history import.
Daemon heartbeat.
React daemon status.
```

## Week 7–8: Vault MVP

```txt
Crypto package.
Device keypairs.
OS keychain storage.
Encrypted vault item schema.
dcc env push.
dcc env pull.
Vault UI.
Device revocation.
```

## Week 9–11: Remote Manager MVP

```txt
Encrypted SSH/SFTP credential creation.
SFTP browser.
Remote file open.
Monaco remote editor.
Pre-save snapshot.
Conflict check.
Atomic save.
Audit logs.
```

## Week 12–14: Intelligence Layer

```txt
Parser registry.
AST workers.
Symbol extraction.
Auto-linking.
Hybrid search.
Embeddings.
ER diagram generation.
Canvas integration.
```

---

# 10. Architectural Boilerplate

## 10.1 Express Route Pattern

```ts
import { Router } from "express";
import { z } from "zod";
import { Artifact } from "../models/artifact";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const CreateArtifactSchema = z.object({
  workspaceId: z.string(),
  kind: z.enum(["snippet", "markdown", "canvas", "credential"]),
  title: z.string().min(1).max(240),
  tags: z.array(z.string()).default([]),
  contentText: z.string().optional(),
  contentEnvelope: z.unknown().optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const input = CreateArtifactSchema.parse(req.body);

  if (input.kind === "credential" && !input.contentEnvelope) {
    return res.status(400).json({
      error: "Credential artifacts must use encrypted envelopes",
    });
  }

  const artifact = await Artifact.create({
    ownerId: req.user.id,
    ...input,
  });

  req.app.get("queues").artifactIndex.add("artifact.created", {
    artifactId: artifact.id,
  });

  req.app.get("io").to(`user:${req.user.id}`).emit("artifact.created", {
    artifactId: artifact.id,
    workspaceId: input.workspaceId,
  });

  res.status(201).json({ artifact });
});

export default router;
```

---

## 10.2 Crypto Package Interface

```ts
export type EncryptedEnvelope = {
  version: number;
  alg: "xchacha20poly1305-ietf" | "aes-256-gcm";
  nonce: string;
  ciphertext: string;
  aad: string;
  wrappedKeys: Array<{
    recipientType: "device" | "user" | "team";
    recipientId: string;
    wrapAlg: "x25519-sealed-box" | "aes-key-wrap";
    nonce?: string;
    wrappedKey: string;
  }>;
  keyVersion: number;
};

export interface CryptoProvider {
  generateDeviceKeypair(): Promise<{
    publicEncryptionKey: string;
    privateEncryptionKey: string;
    publicSigningKey: string;
    privateSigningKey: string;
  }>;

  encryptForDevices(input: {
    plaintext: Uint8Array;
    aad: Uint8Array;
    recipients: Array<{
      deviceId: string;
      publicEncryptionKey: string;
    }>;
  }): Promise<EncryptedEnvelope>;

  decryptFromEnvelope(input: {
    envelope: EncryptedEnvelope;
    privateEncryptionKey: string;
    recipientDeviceId: string;
  }): Promise<Uint8Array>;

  signMutation(input: {
    payload: Uint8Array;
    privateSigningKey: string;
  }): Promise<string>;

  verifyMutation(input: {
    payload: Uint8Array;
    signature: string;
    publicSigningKey: string;
  }): Promise<boolean>;
}
```

---

## 10.3 Remote Save Interface

```ts
export type RemoteSaveRequest = {
  connectionId: string;
  path: string;
  baseStat: {
    size?: number;
    mtimeMs?: number;
    contentHash?: string;
  };
  newContent: string;
  encoding: "utf8";
};

export type RemoteSaveResult =
  | {
      status: "saved";
      preSaveSnapshotId: string;
      postSaveHash: string;
    }
  | {
      status: "conflict";
      remoteStat: unknown;
      remoteContentPreview?: string;
      diffArtifactId?: string;
    };

export interface RemoteConnector {
  readFile(connectionId: string, path: string): Promise<{
    content: Buffer;
    stat: RemoteStat;
  }>;

  saveFileWithSnapshot(request: RemoteSaveRequest): Promise<RemoteSaveResult>;

  listDirectory(connectionId: string, path: string): Promise<RemoteFileEntry[]>;

  execScript(connectionId: string, commandProfileId: string, args: string[]): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
}
```

---

# 11. Production Readiness Checklist

## Security

```txt
Argon2id password hashing.
E2E vault encryption.
Per-device key wrapping.
Device revocation.
Strict host key checking.
No plaintext secrets in logs.
No plaintext secrets in MongoDB.
No shell interpolation.
Rate limits on auth and sync.
Audit logs for vault access and remote operations.
```

## Reliability

```txt
Idempotent sync mutations.
Local offline queue.
Retryable background jobs.
Dead-letter queues.
MongoDB indexes deployed via migrations.
Remote save conflict detection.
Socket reconnect with resume.
Change Stream resume tokens.
```

## Observability

```txt
OpenTelemetry traces.
Structured logs.
Worker queue metrics.
Sync lag metrics.
Daemon heartbeat metrics.
Remote operation audit events.
Search latency histograms.
Parser failure rates.
```

## Privacy

```txt
E2E workspace mode.
Local-only workspace mode.
Opt-in semantic indexing.
Embedding privacy labels.
Local OCR for encrypted workspaces.
Redaction previews before terminal sync.
```

---

# 12. Final Recommended MVP Scope

Build the MVP in this exact order:

```txt
1. Workspace + Artifact CRUD
2. Version history
3. React snippet/markdown UI
4. Socket.IO realtime invalidation
5. Local daemon registration
6. CLI quick capture
7. Encrypted .env vault
8. Terminal history import
9. SFTP browser
10. Remote file editor with pre-save snapshots
11. AST symbol extraction
12. Hybrid search
13. Canvas linking
```
