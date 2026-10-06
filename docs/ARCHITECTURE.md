# VIS — Architecture

## Bölünmenin mimarisi

VIS **açıklar**, CVL **ölçer**. Bu, iki ayrı depo değil, iki ayrı *sorumluluktur* ve mimarinin
tamamı bu ayrımın sürdürülebilir olması için kurulmuştur.

```
src/content/
  types.ts          TR/EN metin çifti (eski motor tipleriyle yolculuk etmesin diye taşındı)
  laboratory-link.ts  sınır sözleşmesi: ölçen uygulama, sekiz katman, measureLink()
  library.ts        bilgi bankası: 7 katman, kavramlar, birincil kaynaklar
  flashcards.ts     SM-2 zamanlayıcı + kavramlardan türetilen kartlar
  i18n.ts           arayüz metinleri (yalnızca öğretim yüzeyine ait sözcükler)
src/App.tsx         iki yüzey: bilgi bankası ve tekrar
src/KnowledgeBank.tsx  bilgi bankası — ölçüm çağırmaz, bağlantı verir
src/LearnView.tsx       tekrar — puan vermez, okur puanlar
src/learning/progress.ts  localStorage ilerleme; okuma anında yeniden doğrulanır
```

**`src/engine` yoktur.** Bu bir eksiklik değil, sözleşmenin kendisidir: motoru olmayan bir
yüzey ölçüm iddiasında bulunamaz. `release.json` bunu `measurementEngine: false` olarak
yayımlar ve `scripts/verify-dist.mjs` yayınlanan artifact içinde bir ölçüm şeması bulursa
derlemeyi başarısız kılar.

## Ölçüm ile açıklama ayrımı

| Uygulama | Ne yapar | Motor | Kanıtı |
|---|---|---|---|
| VIS | Kavramı anlatır, kaynağını gösterir | Yok | `no-engine` yapısal testi |
| CVL | Cevap anahtarına karşı hesaplar | CPU + isteğe bağlı WebGPU | `ground-truth` sözleşme testi |

Sınır **karşılıklı bir bağlantıyla** görünür kılınır:

- Her VIS kavramı, `laboratory-link.ts` içindeki `LaboratoryLayer` değerlerinden birini adlandırır
  ve arayüzdeki "Bunu ölç" düğmesi `https://cvl.aserdargun.com/#katman-<katman>` adresine giden
  gerçek bir dış bağlantıdır.
- Her CVL katmanı, kendi okuması için `https://vis.aserdargun.com/#katman-<katman>` bağlantısını
  taşır.

Böylece hiçbir kavram yalnızca okuyucunun güvenine dayanmaz: açıklamayı okuyan kişi onu
ölçebileceği katmana bir tıkla ulaşır, ölçümü yapan kişi de ne ölçtüğünün kaynağına.

Bu ayrım **yeni**: daha önce VIS de kendi laboratuvarını barındırıyordu ve o yüzey CVL'in
kopyasıydı. İki motor, iki cevap anahtarı ve okuyucunun hangisinin konuştuğunu ayırt
edemediği iki ölçüm vardı. Kopya kaldırıldığında aynı zamanda bakım yükü de ortadan kalktı.

## Kaynaklar

Kaynaklar birincildir (makale veya kurumsal belge) ve `https://` ile başlar. Bir katmanın
kaynağı yoksa o katman kabul edilmez; `tests/library.test.ts` bunu reddeder. Kaynak metinleri
ve kavram özetleri TR/EN çiftleriyle yazılır ve `tests/library.test.ts` her alanın iki
dilde de bulunduğunu doğrular.

## Metinde sayı olmaz

`tests/library.test.ts` bilgi bankasının tüm metnini tarar ve hiçbir rakam bulamaz. Kaynak
yılları (1998, 1986) metaveridir ve bu taramadan muaftır; metnin kendisi sayı içeremez,
çünkü okuyucunun yeniden hesaplayamayacağı bir sayı bir iddiadır.

Tek istisna, okurun kendi tekrar geçmişinden gelen sayaçlardır: bunlar dünyaya ilişkin bir
iddia değil, okurun ne yaptığının kaydıdır.

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

## Dil eşdeğerliği

TR ve EN yüzeyleri birebir denktir. `src/content/i18n.ts` yalnızca öğretim yüzeyine ait
sözcükleri taşır: ölçüm adı, motor probu veya eşik kontrolü gibi bir sözcük burada
bulunamaz, çünkü cevap anahtarı olmadan hiçbirinin anlamı kalmaz.