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
src/App.tsx     arayüz — mantık çağırmaz, yalnızca gösterir
```

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

## Determinizm

- Tüm rastgelelik `mulberry32` üzerinden tohumdan türetilir; `Math.random` hiçbir yerde yoktur.
- Eğitim kümesi, değerlendirilen sahne dışında tutulur (`1000 + seed*17 + i*101`); ağ kendi
  cevap anahtarını görmeden ölçülür.
- Ağırlıklar yapılandırmaya göre önbelleklenir; iki çalıştırma aynı ağırlıkları üretir.
- Eşikler görüntüden türetilir (Otsu), elle seçilmez.
