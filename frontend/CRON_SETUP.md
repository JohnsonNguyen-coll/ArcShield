# Vercel Cron Setup Guide

## 🚀 Setup Oracle Auto-Update với Vercel Cron

### Bước 1: Deploy lên Vercel

```bash
cd frontend
vercel deploy --prod
```

Hoặc push code lên GitHub và connect với Vercel.

### Bước 2: Configure Environment Variables

Trong Vercel Dashboard → Project Settings → Environment Variables:

#### Required Variables:

```env
# Oracle Contract Address (từ deploy output)
NEXT_PUBLIC_PRICE_ORACLE_ADDRESS=0x1234...

# Private Key của deployer (owner của oracle contract)
ORACLE_UPDATER_PRIVATE_KEY=0xabcd...

# Optional: API Key để test manual (generate random string)
# Generate: openssl rand -hex 32
ORACLE_UPDATE_API_KEY=your-secret-api-key-here
```

⚠️ **Security Notes:**
- `ORACLE_UPDATER_PRIVATE_KEY`: Chỉ dùng cho testnet! Trong production cần multi-sig
- `ORACLE_UPDATE_API_KEY`: Generate random string: `openssl rand -hex 32`
- Vercel tự động set `x-vercel-cron` header, không cần config thêm

### Bước 3: Verify Cron Job

1. Vào Vercel Dashboard → Project → Settings → Cron Jobs
2. Bạn sẽ thấy:
   ```
   Path: /api/update-oracle
   Schedule: 0 * * * * (Every hour at minute 0)
   ```

### Bước 4: Test Manual (Optional)

#### Test với API Key:

```bash
curl -H "Authorization: Bearer your-secret-api-key-here" \
  https://your-app.vercel.app/api/update-oracle
```

#### Test trong Development:

```bash
# Không cần auth trong dev mode
curl http://localhost:3000/api/update-oracle
```

### Bước 5: Monitor Cron Jobs

#### Vercel Dashboard:
- Settings → Cron Jobs → View logs
- Xem execution history và errors

#### Check Logs:
```bash
vercel logs --follow
```

#### Monitor Oracle Prices:
- Frontend sẽ hiển thị "Stale" warning nếu giá > 24h chưa update
- Check transaction trên [ArcScan](https://testnet.arcscan.app)

---

## 📊 Cron Schedule Options

Edit `vercel.json` để thay đổi schedule:

```json
{
  "crons": [
    {
      "path": "/api/update-oracle",
      "schedule": "0 * * * *"  // Mỗi giờ
    }
  ]
}
```

### Common Schedules:

- `0 * * * *` - Mỗi giờ (khuyến nghị)
- `*/30 * * * *` - Mỗi 30 phút
- `0 */6 * * *` - Mỗi 6 giờ
- `0 0 * * *` - Mỗi ngày lúc midnight

Format: `minute hour day month weekday`

---

## 🔐 Security Best Practices

### 1. API Key Protection

Generate strong API key:
```bash
openssl rand -hex 32
```

### 2. Private Key Security

⚠️ **Testnet Only:**
- Private key chỉ dùng cho testnet
- Trong production, dùng:
  - Multi-sig wallet
  - Timelock contract
  - Or dedicated oracle updater service với key rotation

### 3. Rate Limiting

API route đã có protection:
- ✅ Vercel Cron only (default)
- ✅ API key required (manual calls)
- ✅ Development mode bypass (local testing)

### 4. Monitoring & Alerts

Setup alerts nếu cron fails:
- Vercel → Settings → Notifications
- Hoặc dùng external monitoring (UptimeRobot, etc.)

---

## 🐛 Troubleshooting

### Cron không chạy?

1. **Check Environment Variables:**
   ```bash
   vercel env ls
   ```

2. **Verify Cron Configuration:**
   - Check `vercel.json` có đúng format không
   - Redeploy sau khi thay đổi `vercel.json`

3. **Check Logs:**
   ```bash
   vercel logs --follow
   ```

### "Unauthorized" Error?

- ✅ Vercel Cron: Tự động có `x-vercel-cron-secret` header
- ✅ Manual test: Cần `Authorization: Bearer YOUR_API_KEY`
- ✅ Development: Không cần auth

### Transaction Failed?

1. **Check Gas:**
   - Oracle update cần gas fees
   - Đảm bảo wallet có đủ USDC

2. **Check Private Key:**
   - Private key phải là owner của oracle contract
   - Verify: `oracle.owner()` trên ArcScan

3. **Check RPC:**
   - RPC URL có accessible không
   - Test connection: `curl https://rpc.testnet.arc.network`

---

## 📝 Example Response

Success response:
```json
{
  "success": true,
  "transactionHash": "0x1234...",
  "blockNumber": "12345678",
  "explorerUrl": "https://testnet.arcscan.app/tx/0x1234...",
  "rates": {
    "BRL": 0.2,
    "MXN": 0.06,
    "EUR": 1.1
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "updatedBy": "vercel-cron"
}
```

Error response:
```json
{
  "error": "ORACLE_UPDATER_PRIVATE_KEY not configured"
}
```

---

## 🎯 Next Steps

1. ✅ Deploy lên Vercel
2. ✅ Set environment variables
3. ✅ Verify cron job trong dashboard
4. ✅ Test manual với API key
5. ✅ Monitor logs và transactions
6. ✅ Check frontend hiển thị giá real-time

---

## 📚 References

- [Vercel Cron Jobs Docs](https://vercel.com/docs/cron-jobs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Cron Expression Format](https://crontab.guru/)

