# Mimari Plan — T.C. Kimlikli Çok Kanallı Yapay Zekâ Ajanı

## Amaç

Terminalden çalışan bir Claude Code ajanını gerçek iletişim kanallarından (email, web, telefon) erişilebilir hale getirmek. Her kanal, düz bir Anthropic API çağrısı değil, gerçek bir `claude` CLI (Claude Code) oturumunu çalıştırarak yanıt üretir.

Puanlama:
- Telefon adresi: +150 (aranabilir), +50 (arayabilir)
- Email adresi: +50 (gönder + al)
- Website: +50
- Tüm kanalların Claude Code/Codex'e yönlendirilmesi: çekirdek gereksinim

## Kimlik altyapısı: Inkbox Identity

[Inkbox](https://inkbox.ai/docs/capabilities/identities) her `create_identity()` çağrısında atomik olarak bir mailbox + public tunnel (+ opsiyonel telefon numarası) sağlıyor. Bir identity'nin **tek bir tunnel'ı** var; bu proje iki farklı public yüzey (email/telefon bridge'i ve website) istediği için **iki ayrı identity** kullanılıyor:

| Identity | Kanal | Kimlik türü |
|---|---|---|
| `tc-kimlik-ajan` | Email (+ telefon-hazır) | Self-signup, overseer email ile doğrulanmış |
| `tc-kimlik-web` | Website | Self-signup, overseer email ile doğrulanmış |

Her iki identity de aynı insan denetleyiciye (overseer email) bağlı; ücretsiz Inkbox planı organizasyon başına 3 identity'ye kadar izin veriyor.

## Kanal 1: Email — resmi Inkbox Claude Code bridge'i

Baştaki plan email/telefon köprüsünü sıfırdan (özel bir TypeScript orkestratörü olarak) yazmaktı. Araştırma sırasında Inkbox'ın bunun için resmi, üretim kalitesinde bir çözümü olduğu ortaya çıktı: [`inkbox-ai/claude-code-plugin`](https://github.com/inkbox-ai/claude-code-plugin) (`inkbox-claude` CLI). Bu keşif üzerine plan değiştirildi — sıfırdan yazmak yerine bu bridge kuruldu:

- `curl install.sh | bash --no-setup` ile `inkbox-claude` CLI kuruldu.
- `inkbox-claude bootstrap --identity tc-kimlik-ajan --project-dir <repo> --start-gateway` ile `tc-kimlik-ajan` identity'sine bağlandı.
- Bridge açılışta: bir Inkbox tunnel açıyor, mailbox'ın `message.received` webhook'unu bu tunnel'a kaydediyor, gelen her maili contact-keyed bir Claude Agent SDK oturumuna (gerçek `claude` CLI, tam tool erişimiyle, proje dizininde) yönlendiriyor, riskli tool çağrılarını (Bash, Write, Edit) email üzerinden insana onaya soruyor.
- Aynı bridge telefon için de hazır: identity'nin incoming-call action'ını `auto_accept` olarak ayarladı; numara eklenince otomatik devreye girecek.

**Neden bu şekilde:** Bridge, oturum yönetimi, izin escalation'ı, ses STT/TTS entegrasyonu gibi projenin en riskli/zaman alıcı kısımlarını zaten çözmüş durumda. Sıfırdan yazmak hem daha yavaş hem daha kırılgan olurdu.

## Kanal 2: Website — özel, minimal TypeScript sunucu

Bridge, `tc-kimlik-ajan`'ın tek tunnel'ını kendi webhook sunucusu için kullandığından, website için ayrı bir identity + ayrı bir sunucu gerekti (`src/` altında, bu repoda):

```
src/
  index.ts          — Inkbox tunnel'a bağlanır (@inkbox/sdk/tunnels/connect, in-process Fetch handler)
  server.ts          — GET / (chat sayfası) ve POST /api/chat rotalarını işler
  chatPage.ts         — tek dosyalık minimal chat arayüzü (HTML+JS, oturum id'si localStorage'da)
  claudeBridge.ts      — `claude -p --output-format json [--resume <id>]` alt-process wrapper'ı
  sessionStore.ts       — conversationKey → claude session id (data/web-sessions.json)
```

**Güvenlik kararı:** Website endpoint'i herkese açık olduğu için `claude -p` çağrısı `--tools ""` ile çalışıyor — hiçbir dosya/Bash/web erişimi yok, sadece konuşma. (Bridge tarafı bunun aksine tam tool erişimine sahip, çünkü orada bir insan onay mekanizması var; website'te böyle bir mekanizma kurmak kapsam dışı olduğundan en güvenli varsayılan seçildi: tool'ları tamamen kapatmak.)

Oturum devamlılığı `claude`'un `--resume <session_id>` flag'i ile sağlanıyor; ilk mesajda dönen `session_id` dosyaya kaydedilip sonraki mesajlarda kullanılıyor.

## Kanal 3: Telefon — Vapi (Inkbox paid plan yerine)

Dedike bir telefon numarası Inkbox'ın Developer planını ($30/ay) gerektiriyordu; kullanıcı bu yatırımı ertelemeyi tercih etti. Alternatif olarak [Vapi](https://vapi.ai) araştırıldı: ücretsiz bir ABD telefon numarası veriyor (kredi kartı zorunlu değil) ve "Custom LLM" özelliğiyle kendi OpenAI-uyumlu backend'ine bağlanabiliyor — bu da tam olarak zaten inşa ettiğimiz `claudeBridge.ts`'i yeniden kullanmamıza izin verdi.

**Uygulama:**

1. `src/claudeBridge.ts`'e stateless bir fonksiyon eklendi: `askClaudeOnce(prompt)` — `--resume` kullanmadan tek seferlik `claude -p` çağrısı. Vapi her turda konuşmanın tam geçmişini gönderdiği için ayrı bir session store'a gerek yok.
2. `src/server.ts`'e yeni bir route eklendi: `POST /chat/completions` — aynı `tc-kimlik-web` tunnel'ında yayında (üçüncü bir identity açmaya gerek kalmadı). Gelen OpenAI-format mesaj listesini tek bir "telefon görüşmesi" prompt'una çevirip `askClaudeOnce`'a veriyor, cevabı OpenAI `chat.completion` formatında geri döndürüyor.
3. Bu endpoint bir paylaşılan sırla (`PHONE_BRIDGE_SECRET`) korunuyor — Vapi'nin `Authorization: Bearer <sır>` header'ı eşleşmezse 401 dönüyor. Ayrıca `--tools ""` ile tool erişimi kapalı (website'teki gibi, herkese açık bir endpoint).
4. Vapi API'sinde bir assistant oluşturuldu (`model.provider: "custom-llm"`, `model.url: "https://tc-kimlik-web.inkboxwire.com"` — Vapi bunu OpenAI client `baseURL`'i gibi kullanıp `/chat/completions`'a POST atıyor).
5. Ücretsiz bir Vapi numarası (`+1 442 246 1168`, alan kodu 442 — 415 doluydu) provizyonlanıp bu assistant'a bağlandı.

**Neden bu şekilde:** Inkbox'ın $30/ay'lık planına göre hem ücretsiz hem de zaten yazdığımız kodu (claudeBridge) tekrar kullanan bir çözüm. Trade-off: Inkbox bridge'indeki izin escalation / oturum kalıcılığı gibi gelişmiş özellikler yok — telefon kanalı stateless ve tool'suz, ama puanlama kriterini (gerçek Claude Code'a yönlendirme) aynı şekilde karşılıyor.

## Vitrin: Vercel'de statik landing page

`landing/index.html`, projeyi tanıtan ve canlı chat'e (`tc-kimlik-web.inkboxwire.com`) ve GitHub reposuna link veren statik bir sayfa. **Not:** chat mantığının kendisi Vercel'de çalışmıyor — Vercel'in serverless fonksiyonları `claude` CLI'ını veya kullanıcının yerel Claude oturumunu çalıştıramaz; bu yüzden gerçek chat backend'i Inkbox tunnel'ında (kullanıcının kendi makinesinde) kalmaya devam ediyor. Vercel sadece statik bir ön kapı.

## Sonuç durumu

| Kalem | Puan | Durum |
|---|---|---|
| Email | +50 | ✅ Canlı test edildi |
| Website | +50 | ✅ Canlı test edildi (multi-turn dahil) |
| Telefon (aranabilir) | +150 | 🔧 Kuruldu (Vapi, `+1 442 246 1168`) — canlı arama testi bekleniyor |
| Telefon (arayabilir) | +50 | 🔧 Kuruldu (Vapi `/call` API) — canlı test bekleniyor |
| Claude Code'a yönlendirme | — | ✅ Üç kanal da gerçek `claude` CLI çağırıyor |

**Doğrulanmış toplam: +100 / muhtemel +300.**
