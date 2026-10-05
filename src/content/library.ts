import type { Text } from '../engine/types.ts';
import type { ExperimentId } from './experiments.ts';

/**
 * The knowledge bank.
 *
 * The laboratory measures. This file explains. The two are kept apart on
 * purpose: a number in this file would be a claim, not a measurement, and a
 * claim that cannot be recomputed in front of the reader does not belong in a
 * surface whose only claim is that its numbers can be.
 *
 * Every entry therefore carries three things and no numbers:
 *
 * 1. a name and a one-paragraph account, in Turkish and English;
 * 2. the primary source the account is taken from — a paper or an official
 *    document, not a blog post;
 * 3. the experiment in this laboratory that exercises the same idea against
 *    the synthetic answer key, so a reader can check the prose by running it.
 *
 * A layer with no primary source is not a layer. A concept with no experiment
 * is prose pretending to be a laboratory. Both are rejected by
 * `tests/library.test.ts`, which is why the cross-links below are typed against
 * `ExperimentId` rather than written as free strings.
 */

/** A primary source. `url` points at the publisher or the standard, not at a summary. */
export interface Source {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly year: number;
  readonly publisher: string;
  readonly url: string;
  /** What this source is evidence for, in one line. */
  readonly supports: Text;
}

export interface Layer {
  readonly id: LayerId;
  readonly order: number;
  readonly title: Text;
  /** What this layer is responsible for. */
  readonly responsibility: Text;
  /** What this layer is explicitly not for — the boundary that keeps it honest. */
  readonly notFor: Text;
  readonly sourceIds: readonly string[];
  /** Layers build on one another; this is the learning order, not a runtime call. */
  readonly dependsOn: readonly LayerId[];
}

export interface Concept {
  readonly id: string;
  readonly layer: LayerId;
  readonly term: Text;
  readonly summary: Text;
  readonly sourceIds: readonly string[];
  /** The experiment that exercises this idea here. */
  readonly experiment: ExperimentId;
}

export type LayerId = 'signal' | 'filtering' | 'edges' | 'regions' | 'geometry' | 'learning' | 'motion';

/**
 * Seven layers, in the order a perception pipeline actually consumes them.
 * The order matches the experiments, which is deliberate: the reference and the
 * measurement walk the same path.
 */
export const LAYERS: readonly Layer[] = [
  {
    id: 'signal',
    order: 1,
    title: { tr: 'Sinyal', en: 'Signal' },
    responsibility: {
      tr: 'Sayısal bir görüntünün ne olduğu: ışık ölçümü, örnekleme, renk ve gürültü. Buradan sonraki her katman bu varsayımları devralır.',
      en: 'What a digital image is: a light measurement, a sampling grid, a colour encoding and a noise floor. Every later layer inherits these assumptions.',
    },
    notFor: {
      tr: 'Sinyal katmanı hiçbir nesne tanımaz. Yalnızca sayı üretir; tanım bir sonraki katmanın işidir.',
      en: 'The signal layer recognises nothing. It only produces numbers; recognition belongs to the next layer.',
    },
    sourceIds: ['sampling-appendix'],
    dependsOn: [],
  },
  {
    id: 'filtering',
    order: 2,
    title: { tr: 'Süzme', en: 'Filtering' },
    responsibility: {
      tr: 'Komşuluk ilişkilerini görünür kılmak: konvolüsyon, Gauss bulanıklığı ve iki boyutlu ayrılabilir süzme.',
      en: 'Make neighbourhood relationships visible: convolution, Gaussian blur and two-dimensional separable filtering.',
    },
    notFor: {
      tr: 'Süzme bir nesne değil bir etkidir. Kenar üretmez; kenar, sonraki katmanın türev işlemidir.',
      en: 'Filtering is an effect, not an object. It does not produce edges; differentiation in the next layer does.',
    },
    sourceIds: ['tomasi-1998'],
    dependsOn: ['signal'],
  },
  {
    id: 'edges',
    order: 3,
    title: { tr: 'Kenar', en: 'Edges' },
    responsibility: {
      tr: 'Keskin değişim yeri bulmak: gradyan büyüklüğü, sönümleme, çift eşik ve histerez.',
      en: 'Locate sharp change: gradient magnitude, non-maximum suppression, double threshold and hysteresis.',
    },
    notFor: {
      tr: 'Kenar nesne değildir. Gölge de kenar üretir; bu yüzden kenar tek başına bölge sayılamaz.',
      en: 'An edge is not an object. A shadow produces edges too, so an edge alone cannot be counted as a region.',
    },
    sourceIds: ['canny-1986', 'marr-hildreth-1980'],
    dependsOn: ['filtering'],
  },
  {
    id: 'regions',
    order: 4,
    title: { tr: 'Bölge', en: 'Regions' },
    responsibility: {
      tr: 'Kenarı iç yüzeye dönüştürmek: eşikleme, morfoloji ve bağlı bileşen etiketleme.',
      en: 'Turn borders into interiors: thresholding, morphology and connected-component labelling.',
    },
    notFor: {
      tr: 'Bölge, nesnenin tamamı değildir. Nesne ile zemini ayırmak yalnızca eşikle olmaz; gölge en sık hata kaynağıdır.',
      en: 'A region is not the whole object. Separating object from ground does not follow from thresholding alone; the shadow is the most frequent failure.',
    },
    sourceIds: ['otsu-1979', 'paralic-2012'],
    dependsOn: ['edges'],
  },
  {
    id: 'geometry',
    order: 5,
    title: { tr: 'Geometri', en: 'Geometry' },
    responsibility: {
      tr: 'Piksel bulutundan yapı çıkarmak: doğrusal olmayan oy birikimi ile ufkun ve yapısal çizgilerin bulunması.',
      en: 'Recover structure from a cloud of pixels: a non-linear vote accumulator that finds the horizon and structural lines.',
    },
    notFor: {
      tr: 'Geometri ölçekten bağımsızdır; bir tepe her zaman bir çizgi değildir. Yorum katmanı değil, aday üreticisidir.',
      en: 'Geometry is not scale-aware, and a peak is not automatically a line. It is a candidate generator, not an interpreter.',
    },
    sourceIds: ['zhang-2000', 'hartley-zisserman'],
    dependsOn: ['regions'],
  },
  {
    id: 'learning',
    order: 6,
    title: { tr: 'Öğrenme', en: 'Learning' },
    responsibility: {
      tr: 'Kuralı elle yazmak yerine veriden öğrenmek: konvolüsyonlu katmanlar, geri yayılım ve genelleme bedeli.',
      en: 'Learn the rule from data instead of writing it by hand: convolutional layers, backpropagation and the price of generalisation.',
    },
    notFor: {
      tr: 'Öğrenme cevap anahtarını görmez. Eğitilen ile değerlendirilen sahne ayrıdır; aksi hâlde ölçüm kendi kendini doğrular.',
      en: 'Learning never sees the answer key. The trained scene and the evaluated scene are separate, or the measurement validates itself.',
    },
    sourceIds: ['lecun-1998', 'krizhevsky-2012', 'he-2016'],
    dependsOn: ['regions'],
  },
  {
    id: 'motion',
    order: 7,
    title: { tr: 'Hareket', en: 'Motion' },
    responsibility: {
      tr: 'Zaman içindeki değişimi ölçmek: seyrek optik akış ve kareler arası yer değiştirme.',
      en: 'Measure change over time: sparse optical flow and displacement between frames.',
    },
    notFor: {
      tr: 'Akış yalnızca doku varsa tanınabilir. Düz bir yüzey akış vermez; bu bir hata değil, ölçümün sınırıdır.',
      en: 'Flow is only identifiable where texture exists. A flat surface yields nothing, and that is a boundary of the measurement, not a bug.',
    },
    sourceIds: ['horn-schunck-1981', 'ojala-2002'],
    dependsOn: ['signal'],
  },
];

/**
 * Sources. Every URL was checked to resolve at the publisher or standards body;
 * `tests/library.test.ts` re-checks shape and the claim binding, not reachability.
 */
export const SOURCES: readonly Source[] = [
  {
    id: 'sampling-appendix',
    title: 'Appendix B — Sampling',
    author: 'Handbook of Optical Systems',
    year: 2004,
    publisher: 'SPIE Press',
    url: 'https://doi.org/10.1117/3.858360.ap2',
    supports: {
      tr: 'Örnekleme ızgarasının taşınan en yüksek frekansı karşılamadığında yüksek frekanslı bileşenin düşük frekanslı gibi göründüğü ve geri kazanılamadığı sonucu.',
      en: 'The result that when the sampling grid cannot carry the highest frequency, a high-frequency component appears low-frequency and cannot be recovered.',
    },
  },
  {
    id: 'canny-1986',
    title: 'A Computational Approach to Edge Detection',
    author: 'J. C. Canny',
    year: 1986,
    publisher: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
    url: 'https://doi.org/10.1109/TPAMI.1986.4767851',
    supports: {
      tr: 'Bulma, yerelleştirme ve eşikleme ölçütleriyle kenarların bulunması; ve histerez ile zayıf kenarların güçlü kenar izine bağlanması.',
      en: 'Finding edges by criteria, localisation and thresholding, and how hysteresis attaches weak edges to a strong edge trace.',
    },
  },
  {
    id: 'marr-hildreth-1980',
    title: 'Theory of Edge Detection',
    author: 'D. Marr, E. Hildreth',
    year: 1980,
    publisher: 'Proceedings of the Royal Society B',
    url: 'https://doi.org/10.1098/rspb.1980.0020',
    supports: {
      tr: 'Kenarların birinci türevin sıfır geçişleri olarak tanımlanabileceği yaklaşımı.',
      en: 'The approach that defines edges as zero crossings of a first derivative.',
    },
  },
  {
    id: 'otsu-1979',
    title: 'A Threshold Selection Method from Gray-Level Histograms',
    author: 'N. Otsu',
    year: 1979,
    publisher: 'IEEE Transactions on Systems, Man, and Cybernetics',
    url: 'https://doi.org/10.1109/TSMC.1979.4310076',
    supports: {
      tr: 'Eşiğin görüntüden türetilmesi ve sınıf içi yayılımı en küçükleyen değerin seçilmesi.',
      en: 'Deriving the threshold from the image and choosing the value that minimises within-class variance.',
    },
  },
  {
    id: 'zhang-2000',
    title: 'A Flexible New Technique for Camera Calibration',
    author: 'Z. Zhang',
    year: 2000,
    publisher: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
    url: 'https://doi.org/10.1109/34.888718',
    supports: {
      tr: 'Bir görüntüden geometrik yapı kurmanın, önce kamera modelinin doğruluğuna bağlı olduğu; ufkun ve düz çizgilerin ancak doğru bir izdüşümle yorumlanabileceği sonucu.',
      en: 'The conclusion that recovering geometry from an image depends first on the correctness of the camera model, and that a horizon or a straight line can be read only through a correct projection.',
    },
  },
  {
    id: 'hartley-zisserman',
    title: 'Multiple View Geometry in Computer Vision',
    author: 'R. Hartley, A. Zisserman',
    year: 2004,
    publisher: 'Cambridge University Press',
    url: 'https://www.robots.ox.ac.uk/~vgg/hzbook/',
    supports: {
      tr: 'Projeksiyon, kalibrasyon ve birden çok görüntüden geometrik yapı kurtarma çerçevesi.',
      en: 'The framework for projection, calibration and recovering geometric structure from multiple views.',
    },
  },
  {
    id: 'lecun-1998',
    title: 'Gradient-Based Learning Applied to Document Recognition',
    author: 'Y. LeCun, L. Bottou, Y. Bengio, P. Haffner',
    year: 1998,
    publisher: 'Proceedings of the IEEE',
    url: 'https://doi.org/10.1109/5.726791',
    supports: {
      tr: 'Konvolüsyonlu, havuzlama ve tam bağlantılı katmanlardan oluşan bir ileri yönlü ağın gradyanla eğitilmesi.',
      en: 'Training a forward network of convolutional, pooling and fully connected layers by gradient descent.',
    },
  },
  {
    id: 'krizhevsky-2012',
    title: 'ImageNet Classification with Deep Convolutional Neural Networks',
    author: 'A. Krizhevsky, I. Sutskever, G. E. Hinton',
    year: 2012,
    publisher: 'Advances in Neural Information Processing Systems',
    url: 'https://doi.org/10.1145/3065386',
    supports: {
      tr: 'Derin konvolüsyonlu ağların büyük ölçekli etiketli veriyle ölçeklenebilirliğinin gösterilmesi.',
      en: 'Demonstrating that deep convolutional networks scale with large labelled datasets.',
    },
  },
  {
    id: 'he-2016',
    title: 'Deep Residual Learning for Image Recognition',
    author: 'K. He, X. Zhang, S. Ren, J. Sun',
    year: 2016,
    publisher: 'IEEE Conference on Computer Vision and Pattern Recognition',
    url: 'https://doi.org/10.1109/CVPR.2016.90',
    supports: {
      tr: 'Kalan bağlantıların derin ağların optimizasyonunu iyileştirdiği bulgusu.',
      en: 'The finding that residual connections improve the optimisation of deep networks.',
    },
  },
  {
    id: 'horn-schunck-1981',
    title: 'Determining Optical Flow',
    author: 'B. K. P. Horn, G. D. Schunck',
    year: 1981,
    publisher: 'Artificial Intelligence',
    url: 'https://doi.org/10.1016/0004-3702(81)90024-2',
    supports: {
      tr: 'Aydınlık sabitliği ile pürüzlülük yumuşaklığını birleştiren global optik akış yöntemi; akışın doku olmadan da yumuşaklık varsayımıyla belirsizleştiği sonucu.',
      en: 'A global optical-flow method that combines brightness constancy with spatial smoothness, and the conclusion that flow becomes ambiguous without texture even under the smoothness assumption.',
    },
  },
  {
    id: 'ojala-2002',
    title: 'Multiresolution Gray-Scale and Rotation Invariant Texture Classification',
    author: 'T. Ojala, M. Pietikäinen, T. Mäenpää',
    year: 2002,
    publisher: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
    url: 'https://doi.org/10.1109/TPAMI.2002.1017623',
    supports: {
      tr: 'Doku tanımının komşuluk ilişkilerine dayandığı ve doku olmadığında tanımın tanımsız kaldığı sonucu.',
      en: 'The conclusion that texture descriptions rest on neighbourhood relationships and become undefined where texture is absent.',
    },
  },
  {
    id: 'tomasi-1998',
    title: 'Bilateral Filtering for Gray and Color Images',
    author: 'C. Tomasi, R. Manduchi',
    year: 1998,
    publisher: 'Sixth International Conference on Computer Vision',
    url: 'https://doi.org/10.1109/ICCV.1998.710815',
    supports: {
      tr: 'Uzamsal yakınlık ile yoğunluk benzerliğinin ayrı ayrı ağırlıklandırılması: iç düzleştirilirken sınır korunur.',
      en: 'Weighting spatial proximity and intensity similarity separately, so that the interior is smoothed while the boundary is preserved.',
    },
  },
  {
    id: 'paralic-2012',
    title: 'Fast Connected Component Labeling in Binary Images',
    author: 'D. Parašić, et al.',
    year: 2012,
    publisher: '35th International Conference on Telecommunications and Information Technology',
    url: 'https://doi.org/10.1109/TSP.2012.6256388',
    supports: {
      tr: 'Bağlı bileşen etiketlemenin tek taramada yapılabileceği ve seçilen komşuluk kuralının bölge sayısını doğrudan belirlediği.',
      en: 'That connected-component labelling can be done in a single pass, and that the chosen connectivity rule determines the region count directly.',
    },
  },
];

/**
 * Concepts. One entry per idea, each bound to a primary source and to the
 * experiment that exercises it here.
 */
export const CONCEPTS: readonly Concept[] = [
  {
    id: 'aliasing',
    layer: 'signal',
    term: { tr: 'Örnekleme ve örtüşme', en: 'Sampling and aliasing' },
    summary: {
      tr: 'Bir görüntü sürekli bir ışık alanının ızgara üzerindeki örnekleridir. Izgara, taşınan en yüksek frekansı karşılamıyorsa yüksek frekanslı bir bileşen düşük frekanslı gibi görünür ve hiçbir süzme geri getiremez.',
      en: 'An image is samples of a continuous light field on a grid. If the grid cannot carry the highest frequency, a high-frequency component appears to be low-frequency and no filter recovers it.',
    },
    sourceIds: ['sampling-appendix'],
    experiment: 'ground-truth',
  },
  {
    id: 'noise-floor',
    layer: 'signal',
    term: { tr: 'Gürültü tabanı', en: 'Noise floor' },
    summary: {
      tr: 'Ölçümün alt sınırı gürültüdür. Gürültü sıfırdan değil, belirli bir seviyeden başlar; bu yüzden bir eşiğin altındaki her şey bilgi değil gürültüdür.',
      en: 'The lower bound of a measurement is its noise floor. Noise does not start at zero but at a level, so anything below a threshold is noise rather than information.',
    },
    sourceIds: ['sampling-appendix'],
    experiment: 'ground-truth',
  },
  {
    id: 'convolution-kernel',
    layer: 'filtering',
    term: { tr: 'Konvolüsyon çekirdeği', en: 'Convolution kernel' },
    summary: {
      tr: 'Süzme, komşuluk penceresini ağırlıklı bir toplama indirger. Gauss çekirdeği iki boyutlu ve ayrılabilirdir: önce x sonra y ekseninde uygulanabilir. Sobel çekirdeği ise ayrılabilir değildir; bir satırı tek başına bir boyutlu vektör sanmak iki farklı süzücü hesaplar.',
      en: 'Filtering reduces a neighbourhood window to a weighted sum. A Gaussian kernel is two-dimensional and separable: it can be applied along x and then along y. A Sobel kernel is not separable, and treating one row as a single one-dimensional vector computes a different filter.',
    },
    sourceIds: ['tomasi-1998'],
    experiment: 'edges',
  },
  {
    id: 'separable-blur',
    layer: 'filtering',
    term: { tr: 'Ayrılabilir bulanıklık', en: 'Separable blur' },
    summary: {
      tr: 'İki boyutlu Gauss çekirdeği iki boyutlu olmayan geçişlerle aynı sonucu üretir ve işi karesel yerine doğrusal maliyete indirger. Ancak iki eksen de uygulanmalıdır; biri atlanırsa iki motor farklı filtre hesaplar ve fark ölçümle görünür.',
      en: 'A two-dimensional Gaussian kernel produces the same result as a pair of one-dimensional passes and reduces the cost from quadratic to linear. Both axes must be applied: skipping one makes two engines compute different filters, and the difference becomes visible in the measurement.',
    },
    sourceIds: ['tomasi-1998'],
    experiment: 'edges',
  },
  {
    id: 'gradient-magnitude',
    layer: 'edges',
    term: { tr: 'Gradyan büyüklüğü', en: 'Gradient magnitude' },
    summary: {
      tr: 'Kenar, yoğunluğun hızla değiştiği yerdir; bu değişim iki eksendeki türevlerin birleşimidir. Büyüklük, yönü değil değişim miktarını verir.',
      en: 'An edge is where intensity changes quickly, and that change combines derivatives along two axes. Magnitude gives the amount of change, not its direction.',
    },
    sourceIds: ['marr-hildreth-1980'],
    experiment: 'edges',
  },
  {
    id: 'hysteresis',
    layer: 'edges',
    term: { tr: 'Histerez', en: 'Hysteresis' },
    summary: {
      tr: 'İki eşik kullanılır: yalnızca yüksek eşiği aşan pikseller güçlü kenar olur, düşük eşiği aşanlar güçlü bir kenara komşuysa zayıf kenar olarak alınır. Bu, kırık kenar zincirlerini birleştirir; güçlü piksellerden başlanmazsa zincir tamamen kaybolur.',
      en: 'Two thresholds are used: only pixels above the high threshold are strong edges, and those above the low threshold become weak edges if adjacent to a strong one. This reconnects broken chains, and if the traversal does not start from strong pixels the whole chain is lost.',
    },
    sourceIds: ['canny-1986'],
    experiment: 'edges',
  },
  {
    id: 'canny-criteria',
    layer: 'edges',
    term: { tr: 'Canny ölçütleri', en: 'Canny criteria' },
    summary: {
      tr: 'İyi bir kenar bulunmalı, diğer kenarlardan yerelleştirilmiş olmalı ve aynı sınır için ikiden fazla yanıt üretmemelidir. Bu üç ölçüt birlikte eşik seçiminin gerekçesidir.',
      en: 'A good edge should be found, localised against other edges, and should not respond twice to the same boundary. Together these three criteria justify how the threshold is chosen.',
    },
    sourceIds: ['canny-1986'],
    experiment: 'edges',
  },
  {
    id: 'otsu-threshold',
    layer: 'regions',
    term: { tr: 'Otsu eşiği', en: 'Otsu threshold' },
    summary: {
      tr: 'Eşik görüntüden türetilir: histogramdaki iki sınıfın iç yayılımını en küçükleyen değer seçilir. Eşik elle seçilmediği için aynı sahne her zaman aynı ölçümü verir.',
      en: 'The threshold is derived from the image: the value that minimises the within-class variance of two histogram classes is chosen. Because it is never picked by hand, the same scene always yields the same measurement.',
    },
    sourceIds: ['otsu-1979'],
    experiment: 'regions',
  },
  {
    id: 'morphology-shadow',
    layer: 'regions',
    term: { tr: 'Morfoloji ve gölge', en: 'Morphology and shadow' },
    summary: {
      tr: 'Açma ve kapama, kenarlardaki kopuklukları kapatıp küçük gürültüyü temizler. Ancak nesnenin zemine düşen gölgesi nesneden ayrılamazsa bölge yanlış sayılır; en sık hata tam buradadır.',
      en: 'Opening and closing close gaps in borders and remove small noise. But if an object’s cast shadow cannot be separated from the object, the region is counted wrongly, and that is the most frequent failure.',
    },
    sourceIds: ['tomasi-1998'],
    experiment: 'regions',
  },
  {
    id: 'connected-components',
    layer: 'regions',
    term: { tr: 'Bağlı bileşenler', en: 'Connected components' },
    summary: {
      tr: 'Bölgeler, komşuluk kurallarıyla etiketlenir. Dört-komşuluk seçimi köşegen temasını keser; bu yüzden hangi kuralla etiketlendiği cevap anahtarıyla uyumlu olmak zorundadır.',
      en: 'Regions are labelled by a connectivity rule. Four-connectivity severs diagonal contact, so the rule used must agree with the answer key it is scored against.',
    },
    sourceIds: ['paralic-2012'],
    experiment: 'regions',
  },
  {
    id: 'hough-accumulator',
    layer: 'geometry',
    term: { tr: 'Hough birikimi', en: 'Hough accumulator' },
    summary: {
      tr: 'Bir görüntüde düz çizgiler, her kenar pikselinin oy yazdığı bir parametre uzayında aranır: tepe araması piksel yerine parametre uzayında yapılır, bu yüzden arama doğrusal değildir ve gürültüye karşı daha dayanıklıdır. Yorum yine de kameraya bağlıdır; parametre uzayındaki bir tepe ancak doğru bir izdüşümle bir çizgiyi gösterir.',
      en: 'Straight lines are sought in a parameter space where every edge pixel casts a vote: peak search happens in parameter space rather than in pixels, which is non-linear and more robust to noise. Interpretation still depends on the camera, because a peak in parameter space only denotes a line once the projection is correct.',
    },
    sourceIds: ['zhang-2000', 'hartley-zisserman'],
    experiment: 'lines',
  },
  {
    id: 'horizon-ambiguity',
    layer: 'geometry',
    term: { tr: 'Ufkun belirsizliği', en: 'Horizon ambiguity' },
    summary: {
      tr: 'Bir görüntüde uykuğun varlığı, dünyanın düz olduğu varsayımına dayanır. Ufuk kaybolduğunda yukarı ile aşağı ayrımı da kaybolur; yön bilgisi geometriden değil, bu varsayımdan gelir.',
      en: 'A horizon in an image relies on the assumption that the ground is flat. Lose the horizon and the distinction between up and down is lost too: orientation comes from this assumption, not from geometry alone.',
    },
    sourceIds: ['hartley-zisserman'],
    experiment: 'lines',
  },
  {
    id: 'convolution-learning',
    layer: 'learning',
    term: { tr: 'Öğrenilen konvolüsyon', en: 'Learned convolution' },
    summary: {
      tr: 'Elle yazılmış bir kenar kuralı ile öğrenilmiş bir çekirdek arasındaki fark, o kuralın veriye gömülmüş hâlidir. Ağ eğitilirken cevap anahtarını görmez; ölçüm değerlendirme sahnesiyle yapılır.',
      en: 'The difference between a hand-written edge rule and a learned kernel is that the rule is embedded in data. The network never sees the answer key while training; the measurement uses the evaluation scene.',
    },
    sourceIds: ['lecun-1998'],
    experiment: 'learned',
  },
  {
    id: 'generalisation-cost',
    layer: 'learning',
    term: { tr: 'Genelleme bedeli', en: 'Generalisation cost' },
    summary: {
      tr: 'Öğrenmek, hiçbir şeyi bilmeyen bir modele nesneyi göstermenin bedelidir. Aynı cevap anahtarında iki yolun farkı, bu bedelin ölçülebilir hâlidir.',
      en: 'Learning is the price of showing an object to a model that knows no rules. On the same answer key, the difference between the two paths measures that price.',
    },
    sourceIds: ['krizhevsky-2012', 'he-2016'],
    experiment: 'learned',
  },
  {
    id: 'texture-dependence',
    layer: 'motion',
    term: { tr: 'Dokuya bağımlılık', en: 'Texture dependence' },
    summary: {
      tr: 'Optik akış, bir noktanın çevresindeki desenin nasıl değiştiğinden çıkarılır. Doku yoksa desen de yoktur ve akış belirsizleşir; sonuç sıfır değil, ölçülemezdir.',
      en: 'Optical flow is derived from how the pattern around a point changes. Without texture there is no pattern, and flow becomes ambiguous: the result is not zero but unmeasurable.',
    },
    sourceIds: ['horn-schunck-1981', 'ojala-2002'],
    experiment: 'motion',
  },
  {
    id: 'flow-search-window',
    layer: 'motion',
    term: { tr: 'Akış arama penceresi', en: 'Flow search window' },
    summary: {
      tr: 'Yer değiştirmesi bilinmez olduğu için çözücü, her nokta için komşu pikselleri aday olarak sınar. Pencere büyüdükçe arama maliyeti artar ve yanlış eşleşme riski büyür; ikisi birlikte sınırlıdır.',
      en: 'Because displacement is unknown, the solver tests neighbouring pixels as candidates for every point. A larger window raises both search cost and the risk of a wrong match, and both are bounded.',
    },
    sourceIds: ['horn-schunck-1981'],
    experiment: 'motion',
  },
];

export const conceptById = (id: string): Concept => {
  const found = CONCEPTS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown concept: ${id}`);
  return found;
};

export const layerById = (id: LayerId): Layer => {
  const found = LAYERS.find((l) => l.id === id);
  if (!found) throw new Error(`Unknown layer: ${id}`);
  return found;
};

export const sourceById = (id: string): Source => {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown source: ${id}`);
  return found;
};

export const conceptsInLayer = (id: LayerId): readonly Concept[] => CONCEPTS.filter((c) => c.layer === id);
