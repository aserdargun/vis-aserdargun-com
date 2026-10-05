# VIS — Architecture

## Katmanlar

```
src/engine/     ölçüm mantığı — kopyalanabilir, dilden bağımsız
  types.ts       Tensor sözleşmesi, Engine arayüzü
  rng.ts         mulberry32 — her sahne tohumdan türetilir
  scene.ts       sentetik sahne + piksel başına cevap anahtarı
  ops.ts         klasik CV: gaussian, convolve, sobel, canny, otsu,
                 morphology, connectedComponents, hough, lucasKanade
  metrics.ts     IoU, doğruluk, MAE, kenar hatırlama, tespit raporu
  cnn.ts         çalışma anında eğitilen iki katmanlı ağ
  depth.ts       monoküler ipuçları + Spearman puanlama
  cpuEngine.ts   CPU implementasyonu + karşılaştırma
  gpuEngine.ts   WebGPU implementasyonu + adapter probu
  gpuShaders.ts  WGSL çekirdekleri
  selectEngine.ts motor seçimi + dürüst rapor
  pipeline.ts    deney başına ölçüm

src/content/   yalnızca TR/EN metin
  experiments.ts  sekiz deney: soru, yöntem, beklenti
  library.ts      bilgi bankası: 7 katman, kavramlar, birincil kaynaklar
  flashcards.ts   SM-2 zamanlayıcı + kavramlardan türetilen kartlar
  i18n.ts         arayüz metinleri
src/App.tsx     arayüz — mantık çağırmaz, yalnızca gösterir
src/KnowledgeBank.tsx  bilgi bankası görünümü — ölçüm çağırmaz
src/LearnView.tsx      tekrar görünümü — puan vermez, okur puanlar
src/learning/progress.ts  localStorage ilerleme; okuma anında yeniden doğrulanır
```

## Tekrar katmanı

Kartlar elle yazılmaz, `CONCEPTS`'ten **türetilir**: her kavram bir tanım kartı,
beş kavram ayrıca sınır kartı üretir. Bu yüzden deste bilgi bankasından geride
kalamaz ve kart hiçbir zaman kaynağından ayrı bir iddiaya dönüşemez.

Zamanlama SM-2'dir (Wozniak, 1990): önceki durumun ve takvim gününün saf bir
fonksiyonu, yani aynı geçmiş her zaman aynı programı üretir. Başarısızlık
kartı ertesi güne alır ve sapma sayılır; başarıda aralık 1, 6, sonra kolaylık
çarpanıyla büyür ve çarpan zeminde tutulur.

İki sınır bilinçlidir:

- **Kartlar puansız.** Uygulama doğru ya da yanlış demez; okur `0-5` arası
  not verir. Yine ölçüm sözleşmesi bozulmaz.
- **localStorage güvenilmeyen girdidir.** Sürümler arasında ve elle
  düzenlenebildiği için her alan okuma anında yeniden doğrulanır; bozuk kayıt
  atılır, hata fırlatılmaz. Hesap yok, gönderim yok, backend yok.

## Ölçüm ile açıklama ayrımı

`src/engine` ölçer. `src/content/library.ts` açıklar. Bu iki yüzey bilinçli olarak
ayrıdır ve arayüzde ayrı görünür:

- **Laboratuvar** cevap anahtarına karşı hesaplar; her sayı okuyucunun önünde
  yeniden üretilebilir.
- **Bilgi bankası** yalnızca metin ve kaynak gösterir. `library.ts` motora hiç
  bağımlı değildir, bu yüzden ölçümü temsil edemez. Bir kavramın metninde sayı
  bulunması, okuyucunun yeniden hesaplayamayacağı bir iddiadır; `tests/library.test.ts`
  bunu reddeder.

Her kavram bir deneye bağlanır ve arayüzdeki "Bunu ölç" düğmesi o deneyi
laboratuvarda açar. Yani açıklama, inanmakla değil çalıştırarak denetlenir.

Kaynaklar birincildir (makale veya kurumsal belge) ve `https://` ile başlar.
Bir katmanın kaynağı yoksa o katman kabul edilmez.

## Sözleşme

Her işlem `Tensor → Tensor` alır ve verir:

```ts
interface VisionEngine {
  id: 'cpu' | 'webgpu'
  describe: string
  ops: readonly string[]
  has(op: string): boolean
  run(op, input: Tensor, params?): Promise<Tensor>
}
```

Arayüz motor seçmez, motor kendini seçer (`selectEngine`). Seçim sonucu hem `engine` hem de
kullanıcıya gösterilecek `report` ve `parity` döner.

## Cevap anahtarı sözleşmesi

`buildScene` görüntüyü ve sınıf haritasını **tek boyama geçişinde** üretir. Bu yüzden ikisi
asla ayrışamaz. Nesneler ayrım ölçütüyle yerleştirilir: bir pikseli birden çok siluet sahiplenemez,
aksi halde cevap anahtarı kendisiyle çelişir ve hiçbir dedektör dürüst puanlanamaz.

`ground-truth` deneyi maskeyi doğrudan üreticiden alır ve 1.0000 IoU vermek zorundadır. Sapma,
üreticide hata olduğunun kanıtıdır.

## İki motor, iki doğruluk kuralı

1. **Operatör kapsamı ilan edilir.** `GPU_CAPABLE` veri paralel işlemleri listeler; `canny`
   (histerezis) ve `hough` (birikim) sıralı yapıdadır ve CPU'da kalır. Arayüz bunu isimleriyle
   gösterir.
2. **Fark ölçülür.** `selectEngine` sabit bir sonda sahnesi üzerinde her GPU işlemini CPU ile
   karşılaştırır ve maksimum mutlak farkı raporlar. `f32`/`f64` yuvarlama farkı beklenir; büyük
   fark bir hatanın işaretidir.

## Yakalanmış iki hata

Bunlar regresyon testleriyle korunur, çünkü ikisi de sessizdi:

- **Gauss'ın ikinci geçişi sabit bir satır okuyordu.** Bulanıklık x ekseninde iki kez uygulanıyor,
  y hiç dokunulmuyordu. GPU yolu her iki ekseni de doğru işlediği için iki motor *farklı filtreler*
  hesaplıyor ve 0.16 sapıyordu.
- **Sobel çekirdeği ayrılabilir 1B geçiş olarak ele alınıyordu.** Sobel satırı tek bir 1B vektör
  değildir; sapma 0.51'di. Artık çekirdekler `ops.ts`'ten dışa aktarılır ve iki motor aynı
  matrisi kullanır.

## Ölçüm ve metin ayrımı

Motor gerçekleri (adapter, üretici, mimari, CPU/GPU paritesi) **bir kez** ölçülür ve
`EngineFacts` olarak saklanır. Bunları anlatan metin ise render anında `describeSelection(facts, lang)`
ile türetilir. İkisi aynı `useEffect` içinde olsaydı, TR/EN arasında geçiş yapmak altı GPU
gidiş-dönüşünü yeniden tetiklerdi — dil değişikliğinin asla hak etmediği bir ölçüm işi.
Ölçüm değerleri iki dilde birebir aynıdır; yalnızca açıklama metni değişir.

## Determinizm

- Tüm rastgelelik `mulberry32` üzerinden tohumdan türetilir; `Math.random` hiçbir yerde yoktur.
- Eğitim kümesi, değerlendirilen sahne dışında tutulur (`1000 + seed*17 + i*101`); ağ kendi
  cevap anahtarını görmeden ölçülür.
- Ağırlıklar yapılandırmaya göre önbelleklenir; iki çalıştırma aynı ağırlıkları üretir.
- Eşikler görüntüden türetilir (Otsu), elle seçilmez.
