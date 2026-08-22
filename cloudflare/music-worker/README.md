# 理想机音乐 Cloudflare Worker

这个 Worker 是音乐 App 的安全接口层。它不保存网易云账号密码，只转发二维码登录状态、登录会话和个人资料请求，并把上游的登录 Cookie 传回浏览器。

## 配置

先进入本目录：

```sh
cd cloudflare/music-worker
```

设置上游授权服务地址。不要把密钥写入代码：

```sh
npx wrangler secret put UPSTREAM_BASE_URL
```

`UPSTREAM_BASE_URL` 应该是你有权使用的音乐服务接口根地址。然后把 `wrangler.jsonc` 中的 `ALLOWED_ORIGIN` 改成实际网页地址；本地测试可保留 `http://localhost:8787`。

部署：

```sh
npx wrangler deploy
```

部署后，在网页初始化前设置：

```js
window.IdealMachineConfig = {
  neteaseApiBase: 'https://你的-worker-域名.workers.dev/api'
};
```

## 已开放的接口

- `/api/auth/qr/key`
- `/api/auth/qr/create`
- `/api/auth/qr/check`
- `/api/user/profile`
- `/api/user/account`
- `/api/user/playlist`
- `/api/user/vip`
- `/api/search`
- `/api/lyric?id=歌曲 ID`
- `/api/song/:id/url`

接口采用白名单，其他路径不会被转发。完整播放仍必须由上游服务按账号权限返回，Worker 不会绕过 VIP 或版权限制。
