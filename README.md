# NetPulse AI

Vercel üzerinde çalışan, misafir kullanıcı destekli çoklu model sohbet başlangıç projesi.

## Özellikler
- Misafir sohbeti; kayıt zorunlu değil.
- Sohbetler tarayıcının `localStorage` alanında saklanır.
- OpenRouter ücretsiz model kataloğu sunucuda okunur.
- Yalnızca `:free` OpenRouter modelleri API üzerinden seçilebilir.
- İsteğe bağlı Groq adaptörü; yalnızca sunucuda tanımlanan `GROQ_MODELS` listesi açılır.
- Yanıtlar SSE ile parça parça gösterilir.
- API anahtarları istemci JavaScript'ine gönderilmez.

## Gereksinimler
- Node.js 20+
- Vercel hesabı
- OpenRouter API anahtarı (ücretsiz modelleri kullanmak için bile sunucu anahtarı gerekir)
- İsteğe bağlı Groq API anahtarı

## Yerel çalıştırma
```bash
npm install -g vercel
vercel dev
```
Vercel proje ayarlarından environment variables ekleyebilir veya yerelde `.env.local` oluşturabilirsin.

## Vercel'e dağıtım
1. Bu klasörü GitHub deposuna yükle.
2. Vercel'de **Add New → Project** ile depoyu içe aktar.
3. Project Settings → Environment Variables bölümünde `OPENROUTER_API_KEY` ekle.
4. İsteğe bağlı olarak `GROQ_API_KEY` ve `GROQ_MODELS` ekle.
5. Deploy et. Değişken ekledikten sonra yeniden deploy gerekir.

## Environment variables

| Değişken | Gerekli | Açıklama |
|---|---|---|
| `OPENROUTER_API_KEY` | Evet | OpenRouter sunucu anahtarı |
| `GROQ_API_KEY` | Hayır | Groq sunucu anahtarı |
| `GROQ_MODELS` | Hayır | Virgülle ayrılmış izinli Groq model kimlikleri |
| `RATE_LIMIT_MAX` | Hayır | Instance başına 10 dakikada varsayılan 20 istek |
| `APP_URL` | Hayır | OpenRouter uygulama referansı |

## Önemli ücretsiz kullanım notları
- OpenRouter ücretsiz modelleri sağlayıcı kapasitesine, model başına sınırlara ve hesap kotalarına tabidir. Ücretsiz hesap limitleri değişebilir.
- Ücretsiz erişim, herkese açık sınırsız üretim hizmeti garantisi değildir.
- Groq model kimlikleri ve ücretsiz limitleri zamanla değişebilir. Yalnızca hesabında gerçekten kullanılabilir modelleri `GROQ_MODELS` içine ekle.
- Vercel Hobby ve üçüncü taraf sağlayıcı limitlerini kontrol et.
- Sunucu yöneticisi API anahtarlarını ekler; ziyaretçiler kendi anahtarlarını girmez.
- Bu başlangıç sürümünde rate limiter bellek içidir. Serverless instance'lar arasında ortak değildir; halka açık yayına almadan önce Redis/Upstash gibi ortak limit deposu, CAPTCHA/abuse koruması ve bütçe alarmı ekle.
- Sohbetler yalnızca aynı tarayıcıdaki localStorage'da saklanır. Tarayıcı verisi silinirse sohbetler de silinir.
- Model yanıtlarını HTML olarak render etmiyoruz; XSS riskini azaltmak için metin olarak gösteriyoruz.

## Güvenlik
- `.env.local` dosyasını Git'e ekleme.
- API anahtarlarını `public/` içine koyma.
- Ücretsiz olmayan model ID'leri OpenRouter yolunda reddedilir.
- Bu örnek üretim öncesi bağımsız güvenlik incelemesi gerektirir.
