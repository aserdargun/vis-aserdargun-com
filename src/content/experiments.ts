import type { DepthCueId } from '../engine/depth.ts';
import type { Text } from '../engine/types.ts';

/**
 * The eight experiments, in the order a perception pipeline actually runs:
 * pixels become edges, edges become regions, regions become objects, objects
 * become distance, distance becomes motion, and then the honest question of
 * what the learned path does differently.
 */

export type ExperimentId =
  | 'ground-truth'
  | 'edges'
  | 'regions'
  | 'lines'
  | 'learned'
  | 'depth'
  | 'motion'
  | 'domain-gap';

export interface Experiment {
  readonly id: ExperimentId;
  readonly index: number;
  readonly title: Text;
  readonly question: Text;
  readonly method: Text;
  readonly expectation: Text;
  readonly track: string;
  /** Humanoid relevance — the reason this experiment exists in this system. */
  readonly humanoid: Text;
  readonly cue?: DepthCueId;
  readonly hasSecondFrame: boolean;
  readonly hasLearnedPath: boolean;
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: 'ground-truth',
    index: 1,
    title: { tr: 'Bilin cevap anahtarı', en: 'The known answer key' },
    question: {
      tr: 'Bu sahne gerçekte ne içeriyor?',
      en: 'What does this scene actually contain?',
    },
    method: {
      tr: 'Prosedürel üretici; görüntü ile sınıf haritası aynı boyama geçişinde üretilir. İkisi asla ayrışamaz.',
      en: 'A procedural generator paints the picture and the class map in one pass, so the two can never drift apart.',
    },
    expectation: {
      tr: 'Sentetik görüntü. Ölçüm ancak buradan sonra anlamlıdır.',
      en: 'A synthetic picture. Every later measurement is only meaningful because of this.',
    },
    track: 'perception',
    humanoid: {
      tr: 'Bir insanoidin dünyayı öğrenmesi de bu yolla başlar: önce doğru cevabı bilirsin, sonra tahmin etmeye çalışırsın.',
      en: 'A humanoid learns the world the same way: know the right answer first, then learn to predict it.',
    },
    hasSecondFrame: false,
    hasLearnedPath: false,
  },
  {
    id: 'edges',
    index: 2,
    title: { tr: 'Kenar mı, gürültü mü?', en: 'Edge, or noise?' },
    question: {
      tr: 'Nesne sınırlarını bulmak ne kadar zor?',
      en: 'How hard is finding the object borders?',
    },
    method: {
      tr: 'Sobel gradyan büyüklüğü, ardından Canny: bulanıklaştırma, sönümleme, çift eşik ve histerez.',
      en: 'Sobel gradient magnitude, then Canny: blur, non-maximum suppression, double threshold and hysteresis.',
    },
    expectation: {
      tr: 'Gürültü kenarları da üretir. Yanlış pozitif sayısı burada ölçülür.',
      en: 'Noise produces edges too. The false-positive count is what gets measured here.',
    },
    track: 'detection',
    humanoid: {
      tr: 'Bir robot kolunun kontur bulması, çarptığı yeri bilmenin ilk adımıdır.',
      en: 'Finding the contour of a robot arm is the first step to knowing what it is about to hit.',
    },
    hasSecondFrame: false,
    hasLearnedPath: false,
  },
  {
    id: 'regions',
    index: 3,
    title: { tr: 'Kenar bölge değildir', en: 'An edge is not a region' },
    question: {
      tr: 'Kenarları birleştirince nesne çıkıyor mu?',
      en: 'Does closing the edges produce an object?',
    },
    method: {
      tr: 'Doldurma, morfoloji ve 4-komşuluklu bağlı bileşen etiketleme; sonra IoU ile cevap anahtarına eşleme.',
      en: 'Filling, morphology and 4-connected labelling, then IoU matching against the answer key.',
    },
    expectation: {
      tr: 'Gölgeler nesne değildir. En sık hata tam buradadır.',
      en: 'Shadows are not objects. The most common failure lives right here.',
    },
    track: 'segmentation',
    humanoid: {
      tr: 'Yere düşmüş bir gölgeyi nesne sanmak, humanoidin en pahalı hatasıdır.',
      en: 'Mistaking a floor shadow for an object is the most expensive mistake a humanoid can make.',
    },
    hasSecondFrame: false,
    hasLearnedPath: false,
  },
  {
    id: 'lines',
    index: 4,
    title: { tr: 'Düz çizgi nerede?', en: 'Where is the straight line?' },
    question: {
      tr: 'Bir ufkun yokluğunda düz çizgi bulunabilir mi?',
      en: 'Without a horizon, can a straight line still be found?',
    },
    method: {
      tr: 'Hough dönüşümü: her kenar pikseli için (rho, theta) akümülatörü ve tepe arama.',
      en: 'The Hough transform: a (rho, theta) accumulator for every edge pixel, then peak search.',
    },
    expectation: {
      tr: 'Zemin kenarı güçlü bir tepe verir; nesne kenarları zayıf ve gürültülüdür.',
      en: 'The ground boundary gives a strong peak; object edges are weak and noisy.',
    },
    track: 'geometry',
    humanoid: {
      tr: 'A humanoid needs a horizon to know which way is up. Lose it and the world tilts.',
      en: 'A humanoid needs a horizon to know which way is up. Lose it and the world tilts.',
    },
    hasSecondFrame: false,
    hasLearnedPath: false,
  },
  {
    id: 'learned',
    index: 5,
    title: { tr: 'Öğrenmek ne satın alıyor?', en: 'What does learning buy?' },
    question: {
      tr: 'Elle yazılmış yolla öğrenilen yol aynı cevap anahtarında ne kadar ayrışıyor?',
      en: 'On the same answer key, how far does the learned path diverge from the handcrafted one?',
    },
    method: {
      tr: 'Çalışma anında sentetik sahnelerde eğitilen iki konvolüsyonlu katmanlı ağ (4 filtre, 5x5 ve 3x3), sabit tohum, sabit epoch.',
      en: 'A two-layer convolutional net (4 filters, 5x5 and 3x3) trained at runtime on synthetic scenes, fixed seed, fixed epochs.',
    },
    expectation: {
      tr: 'Ağ, cevap anahtarına hiç bakmadan eğitiliyor. Değerlendirme sahnesi eğitim kümesinde yok.',
      en: 'The net never sees the answer key while training. The evaluated scene is not in the training set.',
    },
    track: 'learning',
    humanoid: {
      tr: 'Öğrenme, kenar kurallarını bilmeyen bir modele nesneyi göstermenin bedelidir. Karşılaştırma bu bedeli ölçer.',
      en: 'Learning is the price of showing an object to a model that does not know edge rules. This comparison measures that price.',
    },
    hasSecondFrame: false,
    hasLearnedPath: true,
  },
  {
    id: 'depth',
    index: 6,
    title: { tr: 'Derinlik sensörü yok', en: 'There is no depth sensor' },
    question: {
      tr: 'Tek kameralı bir görüntüden uzaklık tahmin edilebilir mi?',
      en: 'Can distance be inferred from a single image?',
    },
    method: {
      tr: 'İki monoküler ipucu — görünür boyut ve zemin düzlemi konumu — sıralı korelasyonla puanlanır.',
      en: 'Two monocular cues, apparent size and ground-plane position, scored by rank correlation.',
    },
    expectation: {
      tr: 'İpuçları çeliştiğinde ikisi de yanılır. Ağırlık deneyin görünür parametresidir.',
      en: 'When the cues disagree both are wrong. The weight is a visible parameter of the experiment.',
    },
    track: 'depth',
    humanoid: {
      tr: 'Ucuz bir humanoidde derinlik sensörü yoktur. Bu iki ipucu, gerçek donanımın göreli maliyetini temsil eder.',
      en: 'A cheap humanoid has no depth sensor. These two cues stand in for the relative cost of real hardware.',
    },
    cue: 'size',
    hasSecondFrame: false,
    hasLearnedPath: false,
  },
  {
    id: 'motion',
    index: 7,
    title: { tr: 'Kareler arası ne değişti?', en: 'What changed between frames?' },
    question: {
      tr: 'İki kareden nesne hareketi çıkarılabilir mi?',
      en: 'Can object motion be recovered from two frames?',
    },
    method: {
      tr: 'Seyrek Lucas-Kanade; yatay ve dikey bileşenler ayrı tensörlerde, kapsayıcı arama ile.',
      en: 'Sparse Lucas-Kanade, horizontal and vertical components in separate tensors, exhaustive clamped search.',
    },
    expectation: {
      tr: 'Düz doku üzerinde akış kaybolur. Artık yüzey yeterli doku vermez.',
      en: 'Flow fails on flat texture. A blank surface gives nothing to track.',
    },
    track: 'tracking',
    humanoid: {
      tr: 'Görme ve dokunma arasındaki gecikme, bir insanoidin en pahalı sınırıdır. Akış ölçümü bu gecikmeye dair bir ipucu verir.',
      en: 'The gap between seeing and touching is a humanoid\'s most expensive limit. Flow measurement hints at that gap.',
    },
    hasSecondFrame: true,
    hasLearnedPath: false,
  },
  {
    id: 'domain-gap',
    index: 8,
    title: { tr: 'Sentetik eğitim, gerçek dünya', en: 'Synthetic training, real world' },
    question: {
      tr: 'Sentetikte ölçülen sayı gerçek bir fotoğrafta ne kadar tutar?',
      en: 'How much of a number measured on synthetic data survives a real photograph?',
    },
    method: {
      tr: 'Aynı eşik, aynı morfoloji; yalnızca giriş değişir. İki maske yan yana, iki sayı yan yana.',
      en: 'The same threshold, the same morphology; only the input changes. Two masks side by side, two numbers side by side.',
    },
    expectation: {
      tr: 'Sayı düşer. Düşüş miktarı, sentetik verinin gerçek dünya iddiası için ölçülebilir bir sınırdır.',
      en: 'The number falls. By how much is a measurable bound on what synthetic data may claim about the real world.',
    },
    track: 'transfer',
    humanoid: {
      tr: 'Bir humanoid laboratuvarda eğitilir ve kendi odasında çalışır. Bu deney o boşluğun ilk ölçümüdür.',
      en: 'A humanoid is trained in a lab and operates in its own room. This experiment is the first measurement of that gap.',
    },
    hasSecondFrame: false,
    hasLearnedPath: false,
  },
];

export const experimentById = (id: ExperimentId): Experiment => {
  const found = EXPERIMENTS.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown experiment: ${id}`);
  return found;
};
