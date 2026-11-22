export type Article = {
  title: Sentence;
  contents: Paragraph[];
};
type Paragraph = {
  sentences: Sentence[];
};
type Sentence = {
  no: number;
  en: string;
  zh: string;
  words: WordMatch[];
};
export type WordMatch = {
  word: string;
  isPhrase: boolean;
  matchs: string[];
  phrase: string;
};

export type Word = {
  word: string;
  root: string;
  tense: string[];
  related: { word: string; inDic: boolean }[];
  means: WordMean[];
  status?: string;
};
type WordMean = {
  class?: string;
  mean: string;
  ranges?: string[];
  examples?: WordSample[];
  phrases?: WordSample[];
};
type WordSample = {
  content: string;
  mean: string;
};

export interface Token {
  type: "text" | "match";
  text: string;
  matchs?: Word[];
  tip?: WordTip;
}
export interface WordTip {
  word: string;
  isPhrase: boolean;
  notFound?: boolean;
  means: WordMean[];
}
