# 电子书源：导入 Legado / OPDS

电子书馆开关和书源都在管理员配置 `OPDSConfig` 里。存储不是单独的书源文件：OPDS 源写在配置的 `Sources` 数组，Legado 订阅的元数据写在 `LegadoSubscriptions`，订阅 JSON 解析后的书源按块存在全局 KV（`legado:subscription:<id>:manifest` / `chunk:<n>`）。

启用条件：管理后台打开电子书馆，或环境变量 `OPDS_ENABLED=true` / `LEGADO_ENABLED=true`。

## OPDS（整本 EPUB/PDF）

管理后台「电子书源」里新增 OPDS 地址，保存时调用：

`POST /api/admin/config`

请求体是完整管理员配置，其中 `OPDSConfig.Sources[]` 每项至少包含 `id`、`name`、`url`。可选 `searchTemplate`、`preferFormat`（`epub` / `pdf`）、`authMode`（`none` / `basic` / `header`）。

没有后台时，可以用环境变量：

- `OPDS_URL`：单个 OPDS 目录
- `OPDS_SOURCES_JSON`：书源数组 JSON

OPDS 源没有章节目录。`/api/books/read/chapters` 返回 HTTP 422，`code` 为 `chapters_not_applicable`，并带 `acquisitionHint`（`/api/books/file`）和 `manifestHint`（`/api/books/read/manifest`）。不要把这类 422 当成书源故障。

## Legado（搜索 → 目录 → 正文）

管理后台「导入订阅」调用：

`POST /api/admin/legado-subscriptions/import`

```json
{ "name": "订阅名称", "url": "https://example.com/book-sources.json" }
```

`url` 必须是 Legado 书源订阅 JSON（数组，或包在 `data` / `sources` / `bookSources` / `items` / `list` 里）。每条规则需要 `bookSourceUrl`。服务端会拉 JSON、校验、分块入库，并把订阅记到 `OPDSConfig.LegadoSubscriptions`。

刷新：`POST /api/admin/legado-subscriptions/<id>/refresh`  
删除：`DELETE /api/admin/legado-subscriptions/<id>`

临时注入、不进数据库时，可设 `LEGADO_SOURCES_JSON` 为同一格式的规则数组。

导入后用搜索接口确认链路：搜索返回的 `id` 在详情地址可用时等于 `detailHref`。章节接口：

`GET /api/books/read/chapters?sourceId=<id>&bookId=<id>&detailHref=<搜索结果的 detailHref>`

查询参数里的 `detailHref` 是主定位符：只要带了它，就用它打开详情再取目录，不再用 `bookId` 的 `{id}` 模板另拼一页。没有 `detailHref` 时，依次回退到 `bookUrl`、`bookId`，以及和 `bookId` 一起传来的 `href`。已经拿到目录地址时用 `tocHref`。仅有 `href`、没有 `bookId` / `detailHref` / `bookUrl` 时，`href` 仍表示目录地址。OPDS 源即使带了 `detailHref`，章节接口仍返回 422 `chapters_not_applicable`。

目标是同一书源走通：搜索有结果 → 章节列表非空 → 章节正文为文本。OPDS 的合格结果是 422 `chapters_not_applicable`，不是章节正文。
