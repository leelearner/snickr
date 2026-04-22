# Snickr 数据库 Schema 文档

## 概述

Snickr 是一个类似 Slack 的 Web 协作系统，支持用户注册、创建工作区（Workspace）、在工作区中创建频道（Channel）、发送消息等功能。整个数据库由以下 **12 张表** 构成，分为用户管理、工作区管理、频道管理、消息管理四个核心模块。

---

## 表结构详解

### 1. `users` — 用户表

**作用：** 存储所有注册用户的基本信息，是整个系统的核心实体，几乎所有其他表都与其存在外键关联。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `userID` | INTEGER (PK, 自增) | 用户唯一标识，系统自动生成 |
| `email` | VARCHAR(50) | 用户邮箱，全局唯一，注册时必填 |
| `username` | VARCHAR(30) | 用户名，全局唯一，注册时必填 |
| `nickname` | VARCHAR(30) | 昵称，可选，用于显示 |
| `password` | VARCHAR(30) | 用户密码 |
| `created_time` | TIMESTAMP | 账号创建时间，默认为当前时间 |
| `updated_time` | TIMESTAMP | 账号最后更新时间，默认为当前时间 |

**关联关系：**
- 被 `workspaces`、`workspacemember`、`workspaceinvitation`、`channels`、`channelmember`、`channelinvitation`、`messages` 等表通过外键引用

---

### 2. `workspaces` — 工作区表

**作用：** 存储用户创建的工作区信息。工作区是顶层组织单位，类似于 Slack 中的"团队空间"，一个工作区可以包含多个频道和多个成员。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `workspaceID` | INTEGER (PK, 自增) | 工作区唯一标识 |
| `name` | VARCHAR(30) | 工作区名称，必填 |
| `description` | VARCHAR(200) | 工作区描述，可选 |
| `created_time` | TIMESTAMP | 工作区创建时间 |
| `updated_time` | TIMESTAMP | 工作区最后更新时间 |
| `created_by` | INTEGER (FK → users.userID) | 创建者的用户ID，创建者自动成为管理员 |

**关联关系：**
- `created_by` → `users.userID`：记录谁创建了该工作区（ON DELETE SET NULL，用户删除后保留工作区但置空该字段）
- 被 `workspacemember`、`workspaceinvitation`、`channels` 表引用

---

### 3. `roles` — 角色表

**作用：** 定义工作区成员可以拥有的角色类型（如普通成员 `member`、管理员 `admin`），作为枚举查找表使用，便于集中管理和扩展角色。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `roleID` | INTEGER (PK, 自增) | 角色唯一标识 |
| `name` | VARCHAR(20) | 角色名称，全局唯一（如 "admin"、"member"） |

**关联关系：**
- 被 `workspacemember.role` 引用，决定某用户在某工作区中的权限级别

---

### 4. `workspacemember` — 工作区成员表

**作用：** 记录哪些用户已加入哪些工作区，以及他们在工作区中扮演的角色（普通成员或管理员）。这是一张多对多关联表，连接 `users` 和 `workspaces`。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `workspaceID` | INTEGER (FK → workspaces.workspaceID) | 工作区ID，联合主键之一 |
| `userID` | INTEGER (FK → users.userID) | 用户ID，联合主键之一 |
| `role` | INTEGER (FK → roles.roleID) | 该用户在工作区中的角色，必填 |
| `joined_time` | TIMESTAMP | 用户加入工作区的时间 |

**主键：** `(workspaceID, userID)` — 确保同一用户在同一工作区只有一条记录

**关联关系：**
- `workspaceID` → `workspaces.workspaceID`（ON DELETE CASCADE，工作区删除后成员记录同步删除）
- `userID` → `users.userID`（ON DELETE CASCADE，用户删除后成员记录同步删除）
- `role` → `roles.roleID`

**索引：** `idx_workspace_member_user (userID)` — 加速"查询某用户所在的所有工作区"

---

### 5. `status` — 状态表

**作用：** 定义邀请的状态类型（如 `pending`、`accepted`、`declined`），作为枚举查找表，被工作区邀请和频道邀请共用，避免硬编码字符串。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `statusID` | INTEGER (PK, 自增) | 状态唯一标识 |
| `type` | VARCHAR(30) | 状态名称，全局唯一（如 "pending"、"accepted"） |

**关联关系：**
- 被 `workspaceinvitation.status_type` 和 `channelinvitation.status_type` 引用

---

### 6. `workspaceinvitation` — 工作区邀请表

**作用：** 记录管理员邀请其他用户加入工作区的邀请信息，追踪邀请的状态（待处理、已接受、已拒绝）。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `invitationID` | INTEGER (PK, 自增) | 邀请唯一标识 |
| `workspaceID` | INTEGER (FK → workspaces.workspaceID) | 被邀请加入的工作区 |
| `invitee` | INTEGER (FK → users.userID) | 被邀请的用户ID |
| `inviter` | INTEGER (FK → users.userID) | 发出邀请的用户ID（应为工作区管理员） |
| `invited_time` | TIMESTAMP | 邀请发出的时间 |
| `status_type` | INTEGER (FK → status.statusID) | 邀请当前的状态 |

**唯一约束：** `(workspaceID, invitee)` — 确保同一用户在同一工作区只能有一条有效邀请

**关联关系：**
- `workspaceID` → `workspaces.workspaceID`（ON DELETE CASCADE）
- `invitee` → `users.userID`（ON DELETE CASCADE）
- `inviter` → `users.userID`
- `status_type` → `status.statusID`

---

### 7. `channeltype` — 频道类型表

**作用：** 定义频道的类型枚举（`public` 公开、`private` 私有、`direct` 直接消息），作为查找表使用，集中管理频道类型。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `typeID` | INTEGER (PK, 自增) | 类型唯一标识 |
| `name` | VARCHAR(30) | 类型名称，全局唯一（如 "public"、"private"、"direct"） |

**关联关系：**
- 被 `channels.typeID` 引用，决定频道的访问规则

---

### 8. `channels` — 频道表

**作用：** 存储工作区内的频道信息。频道是消息交流的容器，属于某个工作区，并具有明确的类型（公开/私有/直接消息）。频道名在同一工作区内唯一。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `channelID` | INTEGER (PK, 自增) | 频道唯一标识 |
| `workspaceID` | INTEGER (FK → workspaces.workspaceID) | 所属工作区 |
| `channel_name` | VARCHAR(50) | 频道名称，在同一工作区内唯一 |
| `typeID` | INTEGER (FK → channeltype.typeID) | 频道类型（公开/私有/直接消息） |
| `created_by` | INTEGER (FK → users.userID) | 创建该频道的用户 |
| `created_time` | TIMESTAMP | 频道创建时间 |
| `updated_time` | TIMESTAMP | 频道最后更新时间 |

**唯一约束：** `(workspaceID, channel_name)` — 同一工作区内频道名不能重复

**关联关系：**
- `workspaceID` → `workspaces.workspaceID`（ON DELETE CASCADE）
- `typeID` → `channeltype.typeID`
- `created_by` → `users.userID`
- 被 `channelmember`、`channelinvitation`、`messages` 表引用

---

### 9. `channelmember` — 频道成员表

**作用：** 记录哪些用户已加入哪些频道，是连接 `users` 和 `channels` 的多对多关联表。只有频道成员才能读取和发送该频道的消息。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `channelID` | INTEGER (FK → channels.channelID) | 频道ID，联合主键之一 |
| `userID` | INTEGER (FK → users.userID) | 用户ID，联合主键之一 |
| `joined_time` | TIMESTAMP | 用户加入频道的时间 |

**主键：** `(channelID, userID)` — 确保同一用户在同一频道只有一条记录

**关联关系：**
- `channelID` → `channels.channelID`（ON DELETE CASCADE）
- `userID` → `users.userID`（ON DELETE CASCADE）

**索引：** `idx_channel_member_user (userID)` — 加速"查询某用户所在的所有频道"

---

### 10. `channelinvitation` — 频道邀请表

**作用：** 记录频道创建者邀请其他工作区成员加入私有频道的邀请信息，追踪邀请状态。公开频道无需邀请，直接加入；私有频道必须通过此表的邀请流程。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `invitationID` | INTEGER (PK, 自增) | 邀请唯一标识 |
| `channelID` | INTEGER (FK → channels.channelID) | 被邀请加入的频道 |
| `invited_time` | TIMESTAMP | 邀请发出的时间 |
| `status_type` | INTEGER (FK → status.statusID) | 邀请当前的状态 |
| `invitee` | INTEGER (FK → users.userID) | 被邀请的用户ID |
| `inviter` | INTEGER (FK → users.userID) | 发出邀请的用户ID（应为频道创建者） |

**唯一约束：** `(channelID, invitee)` — 确保同一用户在同一频道只能有一条邀请记录

**关联关系：**
- `channelID` → `channels.channelID`（ON DELETE CASCADE）
- `invitee` → `users.userID`（ON DELETE CASCADE）
- `inviter` → `users.userID`
- `status_type` → `status.statusID`

---

### 11. `messages` — 消息表

**作用：** 存储所有频道内发布的消息，是系统的核心业务数据表。消息按发布时间排列，支持全文检索（如 LIKE、CONTAINS）以实现关键词搜索功能。

| 字段名 | 类型 | 说明 |
|---|---|---|
| `messageID` | INTEGER (PK, 自增) | 消息唯一标识 |
| `channelID` | INTEGER (FK → channels.channelID) | 消息所属频道 |
| `content` | VARCHAR(500) | 消息正文内容，必填 |
| `posted_time` | TIMESTAMP | 消息发布时间，默认为当前时间 |
| `posted_by` | INTEGER (FK → users.userID) | 发布消息的用户 |

**关联关系：**
- `channelID` → `channels.channelID`（ON DELETE CASCADE）
- `posted_by` → `users.userID`

**索引：** `idx_messages_channel (channelID)` — 加速"按频道查询所有消息"，是最常用的查询路径

---

## 表间关系总览

### 层级结构

```
users
 ├── workspaces (created_by)
 │    ├── workspacemember (userID, workspaceID, role → roles)
 │    ├── workspaceinvitation (invitee, inviter, status_type → status)
 │    └── channels (created_by, workspaceID, typeID → channeltype)
 │         ├── channelmember (userID, channelID)
 │         ├── channelinvitation (invitee, inviter, status_type → status)
 │         └── messages (posted_by, channelID)
```

### 关键外键关系汇总

| 关系 | 说明 | 删除策略 |
|---|---|---|
| `workspaces.created_by` → `users` | 记录工作区创建者 | SET NULL |
| `workspacemember` → `users` | 用户加入工作区 | CASCADE |
| `workspacemember` → `workspaces` | 工作区包含成员 | CASCADE |
| `workspacemember.role` → `roles` | 成员的工作区角色 | 无 |
| `workspaceinvitation.invitee/inviter` → `users` | 邀请双方 | CASCADE (invitee) |
| `workspaceinvitation.status_type` → `status` | 邀请状态 | 无 |
| `channels.workspaceID` → `workspaces` | 频道归属工作区 | CASCADE |
| `channels.typeID` → `channeltype` | 频道类型 | 无 |
| `channels.created_by` → `users` | 频道创建者 | 无 |
| `channelmember` → `channels` | 频道包含成员 | CASCADE |
| `channelmember` → `users` | 用户加入频道 | CASCADE |
| `channelinvitation` → `channels` | 频道邀请 | CASCADE |
| `channelinvitation.status_type` → `status` | 邀请状态 | 无 |
| `messages.channelID` → `channels` | 消息属于频道 | CASCADE |
| `messages.posted_by` → `users` | 消息发布者 | 无 |

### 共享查找表

| 查找表 | 被引用方 | 用途 |
|---|---|---|
| `roles` | `workspacemember.role` | 定义工作区角色（admin/member） |
| `status` | `workspaceinvitation.status_type`、`channelinvitation.status_type` | 定义邀请状态（pending/accepted/declined） |
| `channeltype` | `channels.typeID` | 定义频道类型（public/private/direct） |

---

## 索引设计说明

| 索引名 | 所在表 | 字段 | 目的 |
|---|---|---|---|
| `idx_messages_channel` | `messages` | `channelID` | 按频道快速检索消息，支持消息时间线展示 |
| `idx_workspace_member_user` | `workspacemember` | `userID` | 快速查找某用户所在的所有工作区 |
| `idx_channel_member_user` | `channelmember` | `userID` | 快速查找某用户所在的所有频道 |

---

## 设计要点说明

1. **级联删除（CASCADE）** 被广泛使用：删除工作区时，其所有频道、成员记录、邀请记录会自动清除；删除频道时，其消息和成员记录同步删除，保证数据一致性。

2. **查找表（Lookup Tables）** 的使用：`roles`、`status`、`channeltype` 均为枚举查找表，避免在业务表中硬编码字符串，便于未来扩展新角色或新状态。

3. **联合唯一约束** 防止重复邀请或重复加入：`(workspaceID, invitee)` 和 `(channelID, invitee)` 确保邀请唯一；`(workspaceID, channel_name)` 确保同一工作区内频道名唯一。

4. **时间戳记录** 所有关键实体（用户、工作区、频道、消息、加入记录、邀请记录）均记录时间，支持审计、排序和按时间过滤查询（如"5天前受邀但未加入"）。
