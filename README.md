# T.C. Kimlikli Çok Kanallı Yapay Zekâ Ajanı

Bir Claude Code ajanını terminalin dışına çıkarıp gerçek dünya iletişim kanallarından (email, web, telefon) erişilebilir hale getiren proje. Kimlik altyapısı olarak [Inkbox Identity](https://inkbox.ai/docs/capabilities/identities) kullanılıyor.

## Mimari

İki ayrı Inkbox identity kullanılıyor (her ikisi de aynı `bahadir.kelleci@icloud.com` overseer'ına bağlı, ücretsiz plan 3 identity'ye kadar izin veriyor):

| Identity / servis | Kanal | Nasıl çalışıyor |
|---|---|---|
| **tc-kimlik-ajan** (Inkbox) | Email | Inkbox'ın resmi [Claude Code bridge](https://github.com/inkbox-ai/claude-code-plugin) plugin'i — gelen mail webhook'unu gerçek bir Claude Code oturumuna (Claude Agent SDK, tam tool erişimiyle) yönlendiriyor, riskli işlemleri email üzerinden onaya soruyor |
| **tc-kimlik-web** (Inkbox) | Website + telefon (Vapi custom-llm) | Bu repodaki minimal TypeScript sunucusu — Inkbox tunnel üzerinden `https://tc-kimlik-web.inkboxwire.com`'da yayında. `POST /api/chat` websitedeki chat için, `POST /chat/completions` ise Vapi'nin sesli asistanının kullandığı OpenAI-uyumlu endpoint |
| **Vapi** | Telefon | `+1 442 246 1168` — ücretsiz Vapi numarası, custom-llm modeli olarak yukarıdaki `/chat/completions` endpoint'ine bağlı. STT/TTS Vapi tarafında, cevap metni gerçek `claude -p` çağrısından geliyor |

Ayrıca `landing/` altında statik bir vitrin sayfası var, Vercel'de yayında: **https://tc-kimlik-yz-ajan.vercel.app**. Bu sayfa sadece projeyi tanıtıp yukarıdaki canlı chat'e ve GitHub reposuna link veriyor — chat mantığının kendisi Vercel'de çalışmıyor (bkz. aşağıdaki not).

İki ayrı Inkbox identity kullanılmasının nedeni: bir identity'nin tek bir tunnel'ı var, ve email bridge'i o tunneli kendi webhook sunucusuna bağlıyor. Website (ve şimdi telefon için Vapi'nin ulaştığı `/chat/completions`) ayrı bir public hostname gerektiğinden ikinci bir identity daha temiz bir çözüm — telefon için üçüncü bir identity açmak yerine aynı `tc-kimlik-web` tunnel'ına yeni bir route eklendi.

**Güvenlik notu:** Website chat ve telefon endpoint'leri herkese açık olduğu için oradaki Claude Code çağrıları `--tools ""` ile çalışıyor — hiçbir dosya/Bash/web erişimi yok, sadece konuşma. `/chat/completions` ayrıca bir `PHONE_BRIDGE_SECRET` ile korunuyor (Vapi'nin `Authorization` header'ı bu sırla eşleşmeli, yoksa 401). Email bridge'i tam tool erişimine sahip ama riskli her işlemi (Bash, Write, Edit) email/SMS üzerinden insana onaya soruyor (bridge'in kendi escalation mekanizması).

## Puanlama Checklist

| Kalem | Puan | Durum |
|---|---|---|
| Email adresi (gönder+al) | +50 | ✅ Tamamlandı — `tc-kimlik-ajan@inkboxmail.com`, canlı test edildi |
| Website | +50 | ✅ Tamamlandı — `https://tc-kimlik-web.inkboxwire.com`, canlı test edildi (multi-turn dahil) |
| Telefon adresi (aranabilir) | +150 | 🔧 Kuruldu (`+1 442 246 1168`, Vapi) — canlı arama testi bekleniyor |
| Telefon (arayabilir) | +50 | 🔧 Kuruldu (Vapi `/call` API) — canlı test bekleniyor |
| Claude Code/Codex'e yönlendirme | — | ✅ Üç kanal da gerçek `claude` CLI çağırıyor (canned response değil) |

**Doğrulanmış toplam: +100 puan.** Telefon canlı testi geçtiğinde +200 daha (+300 toplam).

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

### 3. Telefon (Vapi)

Inkbox'ın dedike numarası ücretli plan gerektirdiğinden ($30/ay), telefon [Vapi](https://vapi.ai)'nin ücretsiz numarasıyla kuruldu — website'in aynı tunnel'ındaki yeni `/chat/completions` route'unu "custom LLM" olarak kullanıyor, ekstra altyapı gerekmedi.

```bash
# Assistant oluştur (model.url = website tunnel'ı, model.headers.Authorization = PHONE_BRIDGE_SECRET)
curl -X POST "https://api.vapi.ai/assistant" -H "Authorization: Bearer $VAPI_API_KEY" ...

# Ücretsiz numara provizyonla ve assistant'a bağla
curl -X POST "https://api.vapi.ai/phone-number" -H "Authorization: Bearer $VAPI_API_KEY" \
  -d '{"provider":"vapi","assistantId":"<id>","numberDesiredAreaCode":"442"}'
```

Tam komutlar için `plan.md`'ye bakılabilir. Giden arama:

```bash
curl -X POST "https://api.vapi.ai/call" -H "Authorization: Bearer $VAPI_API_KEY" \
  -d '{"assistant":{"assistantId":"<id>"},"phoneNumberId":"<id>","customer":{"number":"+90..."}}'
```

Değişken şablonu için `.env.example`'a bak — gerçek değerler `.env`'de (gitignore'da, repoya gitmez).

## Proje yapısı

```
src/
  index.ts          # website tunnel bootstrap
  server.ts         # Fetch-API handler: GET / (chat), POST /api/chat (web), POST /chat/completions (Vapi/telefon)
  chatPage.ts        # tek dosyalık minimal chat UI (HTML+JS)
  claudeBridge.ts     # `claude -p --tools "" --output-format json [--resume]` wrapper + stateless askClaudeOnce
  sessionStore.ts     # conversationKey -> claude session id (data/web-sessions.json)
landing/
  index.html          # Vercel'deki statik vitrin sayfası
.env                 # Inkbox/Vapi API key'leri, identity handle'ları, PHONE_BRIDGE_SECRET (gitignore'da)
```

Email/telefon bridge'in kendi kodu ayrı bir yerde (`~/.inkbox-claude/app`) — bu repo sadece onun `--project-dir`'i (Claude Code'un çalıştığı proje) ve website eklentisini içeriyor.
