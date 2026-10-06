# VIS — Vision Knowledge Bank

**Yedi algı katmanı. Birincil kaynaklar. Her kavram ölçülebilir.**
**Seven perception layers. Primary sources. Every concept is measurable.**

VIS, bilgisayarlı görünün temel şeridinde bir **bilgi bankasıdır**: yedi algı katmanını, her birini
birincil kaynağa bağlayarak açıklar ve **ölçmez**. [aserdargun.com](https://aserdargun.com/)
üzerinde temel şeridinde, [GPU](https://gpu.aserdargun.com/) ve [LLM](https://llm.aserdargun.com/)
ile yan yana durur; hepsini **00 Architect** şeridindeki [AIA](https://aia.aserdargun.com/) türetir.

## VIS açıklar, CVL ölçer

Bu iki uygulama bilinçli olarak ayrıdır ve ikisi de birbirinin kopyası değildir:

| Uygulama | Ne yapar | Motor | Nerede |
|---|---|---|---|
| **VIS** | Kavramı anlatır, kaynağını gösterir, hatırlatmayı ayarlar | Yok — ölçüm motoru içermez | [vis.aserdargun.com](https://vis.aserdargun.com/) |
| **CVL** | Cevap anahtarına karşı hesaplar | CPU varsayılan, WebGPU isteğe bağlı | [cvl.aserdargun.com](https://cvl.aserdargun.com/) |

Bölünmenin nedeni basit: **bir sayının ancak okuyucu onu yeniden hesaplayabiliyorsa ölçüm olur.**
VIS'te ölçüm motoru yoktur, dolayısıyla ortaya çıkan her sayı bir iddiadır — iddialar burada
konumlanmaz. CVL ise kaynak gösteremez, bu yüzden bir işleçin *ne yaptığını* ve *nerede
durduğunu* açıklamaz. Her kavramın altındaki **Bunu ölç** düğmesi, o fikri ölçen laboratuvar
katmanına giden gerçek bir dış bağlantıdır.

Bu, daha önce ikisinin de birbirinin kopyası olan bir dönemin düzeltmesidir: iki ayrı motor,
iki ayrı cevap anahtarı ve okuyucunun hangisinin konuştuğunu ayırt edemediği iki ayrı ölçüm.

**Bütün veriler sentetiktir.** Gerçek kamera, gerçek sahne, önceden eğitilmiş model, hesap
gönderimi, hesap kaydı veya backend yoktur.

## İki yüzey

- **Bilgi bankası** — yedi katman, her biri birincil kaynağa bağlı; açıklar, ölçmez.
- **Tekrar** — kartlar bilgi bankasından türetilir, SM-2 ile zamanlanır, yalnızca bu tarayıcıda
  saklanır. Puanı okur verir.

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

Her katman *ne için değil* sınırını da taşır ve en az bir hakemli kaynağa bağlıdır. Bilgi
bankasında hiçbir sayı ölçüm değildir; ölçümler yalnızca CVL'de hesaplanır.

## Ölçüm nerede?

CVL'de sekiz katman vardır ve her biri cevap anahtarına karşı hesaplanır: `psnr`,
`separableVsNaiveRmse`, `f1`, `meanIoU`, `recall`, `iouDelta`, `objectRankCorrelation`,
`meanEndpointError`. CPU yolu varsayılandır ve tam olarak deterministiktir; WebGPU isteğe bağlıdır
ve desteklemeyen işlemler arayüzde adıyla sayılır.

## Çalıştırma

Node.js 22+ ve npm:

```sh
npm ci
npm start
```

Yerel önizleme: **http://127.0.0.1:8062**

- `npm start`: yalnız bu depoya ait, arka planda yönetilen Vite süreci. `.local/server.log` ve
  `.local/server.json` yazar. Port doluysa başka süreci kapatmaz.
- `npm stop`: kaydedilmiş PID'nin **cwd ve Vite komutunu** doğrulayarak yalnızca bu depoyu durdurur.
- `npm run dev`: ön planda geliştirme; `Ctrl+C` ile durur.
- `npm run build`: TypeScript denetimi, `dist/` derlemesi, `release.json` ve artifact doğrulaması.
- `npm run preview`: derlenmiş uygulama, http://127.0.0.1:8063
- `npm test`: 46 alan testi (kütüphane yapısı, kaynak bağları, kart türetimi, SM-2 zamanlama).
- `npm run test:ui`: 12 tarayıcı testi — yüzey sınırı, kaynak bağları, çapraz bağlantı, tekrar.
- `npm run validate`: lint + build + alan testleri + tarayıcı testleri.

## Doğrulama sözleşmesi

- `sourced`: her katman ve her kavram en az bir hakemli kaynağa bağlıdır.
- `no-numbers`: bilgi bankasının metninde hiçbir sayı yoktur; bulunursa test kızar.
- `cross-linked`: her kavram, onu ölçen bir CVL katmanına dış bağlantı verir.
- `no-engine`: yapısal olarak motor içermez; ölçüm yüzeyi burada yeniden açılamaz.

## aserdargun.com öğrenme sistemindeki yeri

VIS, fiziksel yapay zekâ katmanının algı tarafında **akademik** yarısıdır. [WFM](https://wfm.aserdargun.com/)
perception track'ini ilan eder; VIS o halkayı açıklamayla kapatır, [CVL](https://cvl.aserdargun.com/)
ise ölçümle. [ITL](https://itl.aserdargun.com/), [HEX](https://hex.aserdargun.com/) ve
[ENG](https://eng.aserdargun.com/) ile kavramsal olarak bağlıdır. Bu bağlar öğrenme ilişkileridir:
çalışma, onay veya veri aktarımı olmaz.

## Kapsam

- Eğitim amaçlı, sentetik ve deterministik. Gerçek model, gerçek sensör, telemetri, hesap veya
  kalıcı depolama yoktur.
- Ölçüm şeması CVL'de yaşar: [`cvl.aserdargun.com/schemas/experiment-run.schema.json`](https://cvl.aserdargun.com/schemas/experiment-run.schema.json)
- Dağıtım: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)