# VIS — Vision Laboratory

**Sentetik sahne. Bilinen cevap. Ölçülen algı.**
**Synthetic scene. Known truth. Measured perception.**

VIS, tarayıcı içinde çalışan deterministik bir bilgisayarlı görü laboratuvarıdır. Her sahne prosedürel olarak üretilir ve **piksel başına doğru cevap haritasıyla birlikte** çizilir. Bu yüzden raporlanan her sayı bir ölçümdür, bir tahmin değil.

VIS, [aserdargun.com](https://aserdargun.com/) üzerinde **çalıştırma kulvarında**, [LLM Runtime & Serving Atlas](https://llm.aserdargun.com/) paralelinde duran bilgisayarlı görü bilgi bankasıdır. İki yüzeyi vardır ve kasıtlı olarak ayrıdır:

- **Bilgi bankası** — yedi katman, her biri birincil kaynağa bağlı; açıklar, ölçmez.
- **Laboratuvar** — cevap anahtarına karşı hesaplar; ölçer, açıklamaz.

Her kavram, onu gerçekten çalıştıran bir deneye bağlıdır: bilgi bankasındaki *Bunu ölç* düğmesi o deneyi laboratuvarda açar. Sorulan soru COCO mAP'ı değil: **fizik, ışık, örtüşme ve gecikmeyle karşılaşınca bu algı hayatta kalır mı?**

**Bütün veriler sentetiktir.** Gerçek kamera, gerçek sahne, önceden eğitilmiş model, hesap gönderimi, hesap kaydı veya backend yoktur.

## Bilgi bankası · Knowledge bank

| # | Katman | Sorumluluk |
|---|---|---|
| 01 | Sinyal | Görüntünün sayı üretim biçimi: örnekleme, nicemleme, gürültü. |
| 02 | Süzme | Konvolüsyon, Gauss bulanıklığı, ayrılabilirlik. |
| 03 | Kenar | Gradyan, sönümleme, çift eşik, histerez. |
| 04 | Bölge | Eşikleme, morfoloji, bağlı bileşen etiketleme. |
| 05 | Geometri | Hough birikimi ve yapısal çizgi adayları. |
| 06 | Öğrenme | Konvolüsyonlu ağ ve genelleme bedeli. |
| 07 | Hareket | Seyrek optik akış ve dokuya bağımlılık. |

Her katman *ne için değil* sınırını da taşır ve en az bir hakemli kaynağa bağlıdır. Bilgi bankasında hiçbir sayı ölçüm değildir; ölçümler yalnızca laboratuvarda hesaplanır.

## Deneyler

| # | Deney | Ne ölçüyor |
|---|---|---|
| 01 | Bilin cevap anahtarı | Nesnenin gerçekte nerede olduğu. Ölçümün geçerli olma nedeni. |
| 02 | Kenar mı, gürültü mü? | Sobel + Canny; nesne sınırı bulma zorluğu, kenar hatırlama. |
| 03 | Kenar bölge değildir | Otsu + morfoloji + bağlı bileşen; gölgelerin nesne sanılma hatası. |
| 04 | Düz çizgi nerede? | Hough dönüşümü; ufkun yokluğunda çizgi bulunamaz. |
| 05 | Öğrenmek ne satın alıyor? | Çalışma anında eğitilen küçük CNN ile elle yazılmış yolun **aynı cevap anahtarında** farkı. |
| 06 | Derinlik sensörü yok | Monoküler boyut ve zemin düzlemi ipuçları, sıralı korelasyonla puanlanır. |
| 07 | Kareler arası ne değişti? | Lucas-Kanade akışı; bilinen 3 piksel kaydırmanın geri bulunması. |
| 08 | Sentetik eğitim, gerçek dünya | Aynı eşik, aynı morfoloji; yalnızca giriş değişir. Düşüş ölçülür. |

## İki motor, tek sözleşme

| Motor | Durum | Kapsam |
|---|---|---|
| **CPU** (varsayılan) | Her yerde çalışır, tam olarak deterministik | Tüm işlemler |
| **WebGPU** | `--enable-unsafe-webgpu` gerektirir, isteğe bağlı | Veri paralel işlemler; `canny` ve `hough` sıralı yapılarından dolayı CPU'da kalır |

İkisi de arayüzde **dürüstçe raporlanır**: güvenli bağlam, `navigator.gpu`, adapter, üretici ve mimari ayrı ayrı gösterilir, ve CPU/GPU farkı operatör operatör listelenir. GPU `f32`, CPU `f64` biriktirir; küçük fark normal, büyük fark hatadır.

`requestAdapter()` sessizce `null` dönebilir — `navigator.gpu` var olması bir çekirdeğin çalışacağı anlamına gelmez. Bu yüzden arayüz bunu açıkça söyler ve sessiz geri düşmez.

## Çalıştırma

Node.js 22+ ve npm:

```sh
npm ci
npm start
```

Yerel önizleme: **http://127.0.0.1:8062**

- `npm start`: yalnız bu depoya ait, arka planda yönetilen Vite süreci. `.local/server.log` ve `.local/server.json` yazar. Port doluysa başka süreci kapatmaz.
- `npm stop`: kaydedilmiş PID'nin **cwd ve Vite komutunu** doğrulayarak yalnızca bu depoyu durdurur.
- `npm run dev`: ön planda geliştirme; `Ctrl+C` ile durur.
- `npm run build`: TypeScript denetimi, `dist/` derlemesi, `release.json` ve artifact doğrulaması.
- `npm run preview`: derlenmiş uygulama, http://127.0.0.1:8063
- `npm test`: 40 alan testi (determinizm, operatörler, metrikler, akış, öğrenilen yol).
- `npm run test:ui`: 17 tarayıcı testi — 12 arayüz + 5 WebGPU. GPU paketi gerçek adapter yoksa **atlamaz, başarısız olur**.
- `npm run validate`: lint + build + alan testleri + tarayıcı testleri.

## Doğrulama sözleşmesi

- `deterministik`: aynı tohum → bayt bayt aynı sahne, rastgelelik yok.
- `ground-truth`: üreticinin kendi maskesi 1.0000 IoU vermeli; sapma hata işaretidir.
- `parity`: CPU ve GPU aynı girdide ölçülür, toleranslı karşılaştırılır (1e-3).
- `adapter`: güvenli bağlam → `navigator.gpu` → `requestAdapter()` → `requestDevice()` zinciri açıkça doğrulanır.

## aserdargun.com öğrenme sistemindeki yeri

VIS, fiziksel yapay zekâ katmanının algı tarafıdır. [WFM](https://wfm.aserdargun.com/) perception track'ini ilan eder ama uygulamaz; VIS o halkayı kapatır. [ITL](https://itl.aserdargun.com/), [HEX](https://hex.aserdargun.com/) ve [ENG](https://eng.aserdargun.com/) ile kavramsal olarak bağlıdır. Bu bağlar öğrenme ilişkileridir: çalışma, onay veya veri aktarımı olmaz.

## Kapsam

- Eğitim amaçlı, sentetik ve deterministik. Gerçek model, gerçek sensör, telemetri, hesap veya kalıcı depolama yoktur.
- Sonuç şeması: [`schemas/experiment-run.schema.json`](schemas/experiment-run.schema.json)
- Dağıtım: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
