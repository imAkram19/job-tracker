import fs from 'fs';
import path from 'path';
import { ApprovedAnswer, ConfidenceLevel } from '../types/automation';

export class AnswerManager {
  private filePath: string;
  private answers: ApprovedAnswer[] = [];

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'src', 'automation', 'data', 'approvedAnswers.json');
    this.load();
  }

  public load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.answers = JSON.parse(raw);
      } else {
        this.answers = [];
      }
    } catch (err) {
      console.error('Failed to load approved answers:', err);
      this.answers = [];
    }
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.answers, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist approved answers:', err);
    }
  }

  private normalize(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Finds an approved answer for a question string
   */
  public findAnswer(questionText: string): {
    answer: string | null;
    confidence: ConfidenceLevel;
    approvedItem?: ApprovedAnswer;
  } {
    const norm = this.normalize(questionText);

    for (const item of this.answers) {
      // 1. Direct match with normalized question
      if (norm === this.normalize(item.normalizedQuestion)) {
        return { answer: item.answer, confidence: item.confidence, approvedItem: item };
      }

      // 2. Keyword match: all or majority of keywords match
      const matchingKeywords = item.questionKeywords.filter((kw) =>
        norm.includes(this.normalize(kw))
      );

      if (matchingKeywords.length > 0) {
        return { answer: item.answer, confidence: item.confidence, approvedItem: item };
      }
    }

    return { answer: null, confidence: 'LOW' };
  }

  /**
   * Stores a new approved answer provided by the user
   */
  public addApprovedAnswer(questionText: string, answer: string, confidence: ConfidenceLevel = 'HIGH'): void {
    const norm = this.normalize(questionText);
    const id = `ans_${Date.now()}`;

    // Extract significant keywords
    const words = norm.split(' ').filter((w) => w.length > 3);
    const keywords = words.slice(0, 5);

    const newAnswer: ApprovedAnswer = {
      id,
      questionKeywords: keywords,
      normalizedQuestion: questionText.trim(),
      answer: answer.trim(),
      confidence,
      notes: 'Provided by user during automation',
    };

    // Remove existing identical question if present
    this.answers = this.answers.filter(
      (a) => this.normalize(a.normalizedQuestion) !== norm
    );
    this.answers.push(newAnswer);
    this.save();

    // Asynchronously sync to Supabase QA bank if configured
    try {
      import('@/lib/qaBankSupabase')
        .then(({ saveQaBankRecord }) => {
          saveQaBankRecord(questionText, answer, 'text', { confidence, keywords });
        })
        .catch(() => {});
    } catch {
      // Ignore background import errors in Node CLI environment
    }
  }
}
