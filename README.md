# T.C. Kimlikli Çok Kanallı Yapay Zekâ Ajanı

Bir Claude Code ajanını terminalin dışına çıkarıp gerçek dünya iletişim kanallarından (email, web, telefon) erişilebilir hale getiren proje. Kimlik altyapısı olarak [Inkbox Identity](https://inkbox.ai/docs/capabilities/identities) kullanılıyor.

## Mimari

İki ayrı Inkbox identity kullanılıyor (her ikisi de aynı `bahadir.kelleci@icloud.com` overseer'ına bağlı, ücretsiz plan 3 identity'ye kadar izin veriyor):

| Identity | Kanal | Nasıl çalışıyor |
|---|---|---|
| **tc-kimlik-ajan** | Email (+telefon hazır altyapısı) | Inkbox'ın resmi [Claude Code bridge](https://github.com/inkbox-ai/claude-code-plugin) plugin'i — gelen mail webhook'unu gerçek bir Claude Code oturumuna (Claude Agent SDK, tam tool erişimiyle) yönlendiriyor, riskli işlemleri email üzerinden onaya soruyor |
| **tc-kimlik-web** | Website | Bu repodaki minimal TypeScript sunucusu — Inkbox tunnel üzerinden `https://tc-kimlik-web.inkboxwire.com`'da yayında, her mesajı `claude -p` (headless, **tool'lar kapalı**) ile işliyor |

İki ayrı identity kullanılmasının nedeni: bir identity'nin tek bir tunnel'ı var, ve email/telefon bridge'i o tunneli kendi webhook sunucusuna bağlıyor. Website için ayrı bir public hostname gerektiğinden ikinci bir identity daha temiz bir çözüm.

**Güvenlik notu:** Website chat endpoint'i herkese açık olduğu için oradaki Claude Code çağrıları `--tools ""` ile çalışıyor — hiçbir dosya/Bash/web erişimi yok, sadece konuşma. Email/telefon bridge'i tam tool erişimine sahip ama riskli her işlemi (Bash, Write, Edit) email/SMS üzerinden insana onaya soruyor (bridge'in kendi escalation mekanizması).

## Puanlama Checklist

| Kalem | Puan | Durum |
|---|---|---|
| Email adresi (gönder+al) | +50 | ✅ Tamamlandı — `tc-kimlik-ajan@inkboxmail.com`, canlı test edildi |
| Website | +50 | ✅ Tamamlandı — `https://tc-kimlik-web.inkboxwire.com`, canlı test edildi (multi-turn dahil) |
| Telefon adresi (aranabilir) | +150 | ⏸ Ertelendi — dedike numara Developer plana ($30/ay) geçiş gerektiriyor, karar kullanıcıya bırakıldı |
| Telefon (arayabilir) | +50 | ⏸ Telefon numarasına bağlı |
| Claude Code/Codex'e yönlendirme | — | ✅ Her iki kanal da gerçek `claude` CLI çağırıyor (canned response değil) |

**Mevcut toplam: +100 puan.** Telefon eklendiğinde +200 daha (+300 toplam).

## Kurulum (sıfırdan tekrar kurmak gerekirse)

### 1. Email/telefon bridge (tc-kimlik-ajan)

Zaten kurulu ve `.env`'deki `INKBOX_API_KEY` ile bootstrap edilmiş durumda. Yeniden kurmak gerekirse:

```bash
curl -fsSL https://raw.githubusercontent.com/inkbox-ai/claude-code-plugin/main/install.sh -o /tmp/installer.sh
bash /tmp/installer.sh --no-setup   # inkbox-claude CLI'ı ~/.local/bin'e kurar

export INKBOX_API_KEY="<.env içindeki INKBOX_API_KEY>"
inkbox-claude bootstrap --identity tc-kimlik-ajan --base-url https://inkbox.ai \
  --project-dir "$PWD" --rotate-signing-key --start-gateway
unset INKBOX_API_KEY
```

Yönetim:
```bash
inkbox-claude status      # çalışıyor mu?
inkbox-claude doctor       # sağlık kontrolü
inkbox-claude stop         # durdur
tail -f ~/.inkbox-claude/gateway.log
```

Not: Şu an **boot-persistence (launchd) kurulmadı** — bilinçli bir tercih, geliştirme aşamasındayız. Mac yeniden başladığında ya da terminal kapandığında bridge durur; tekrar `inkbox-claude start` gerekir. 7/24 erişilebilirlik için `inkbox-claude setup` wizard'ı çalıştırıp boot-persistence'ı etkinleştirmek gerekir.

### 2. Website (tc-kimlik-web)

```bash
npm install
npm run dev      # veya: npm run build && npm start
```

`.env` içindeki `INKBOX_WEB_API_KEY` / `INKBOX_WEB_IDENTITY` ile `tc-kimlik-web` identity'sinin tunnel'ına bağlanır ve `https://tc-kimlik-web.inkboxwire.com` adresini açar.

## Telefonu eklemek (ileride)

1. [inkbox.ai/console](https://inkbox.ai/console/) üzerinden Developer plana ($30/ay) geçilir.
2. `inkbox number provision --handle tc-kimlik-ajan` (CLI) veya SDK ile numara provizyonlanır.
3. Bridge zaten `auto_accept` + WebSocket yönlendirmesini identity üzerinde ayarlamış durumda — numara eklenince otomatik devreye girer, `inkbox-claude restart` yeterli olabilir (doğrulama gerekir).
4. `inkbox-claude doctor` ile telefon satırının göründüğünü teyit et.

Değişken şablonu için `.env.example`'a bak — gerçek değerler `.env`'de (gitignore'da, repoya gitmez).

## Proje yapısı

```
src/
  index.ts          # website tunnel bootstrap
  server.ts         # Fetch-API handler: GET / (chat sayfası), POST /api/chat
  chatPage.ts        # tek dosyalık minimal chat UI (HTML+JS)
  claudeBridge.ts     # `claude -p --tools "" --output-format json [--resume]` wrapper
  sessionStore.ts     # conversationKey -> claude session id (data/web-sessions.json)
.env                 # Inkbox API key'leri, identity handle'ları (gitignore'da)
```

Email/telefon bridge'in kendi kodu ayrı bir yerde (`~/.inkbox-claude/app`) — bu repo sadece onun `--project-dir`'i (Claude Code'un çalıştığı proje) ve website eklentisini içeriyor.
