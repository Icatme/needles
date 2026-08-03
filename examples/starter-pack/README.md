# Starter Pack Example

该目录是未注册示例，不会被浏览器运行时自动加载，也不会进入 Pages 发布资源。

推荐从 CLI 创建正式包：

```bash
npm run pack -- create my-pack --title "My Pack" --register
```

然后参考本目录，把：

- `layouts`
- `rhythm.segments`
- `presentation`
- `tags`

复制到新包中。

修改后依次运行：

```bash
npm run pack -- validate
npm run pack -- audit my-pack
npm run preview:pack -- --pack my-pack --lab
```

直接预览具体关卡：

```bash
npm run preview:pack -- \
  --pack my-pack \
  --level my-pack-02 \
  --mode test \
  --skin clockwork-observatory
```

示例只包含 JSON，不包含 JavaScript、renderer 或远程资源。
