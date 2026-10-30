import { describe, expect, it } from 'vitest';
import { completeCaseExperiments } from './whatIfExamples';

describe('complete reconstruction comparison examples', () => {
  it('provides full relational evidence sets with one named fact changed per pair', () => {
    expect(completeCaseExperiments).toHaveLength(3);
    for (const experiment of completeCaseExperiments) {
      expect(experiment.baselineEvidence.length).toBeGreaterThan(10);
      expect(experiment.alternativeEvidence).toHaveLength(experiment.baselineEvidence.length);
      const differences = [...new Set(experiment.baselineEvidence.flatMap((item, index) => {
        const alternative = experiment.alternativeEvidence[index];
        return item.table === alternative?.table && item.recordId === alternative.recordId && item.field === alternative.field && item.value !== alternative.value
          ? [`${item.table}[${item.recordId}].${item.field}`]
          : [];
      }))];
      const expected = experiment.id === 'birth-date-dispute'
        ? ['Person[1].dateOfBirth', 'SourceObservation[1].observedValue']
        : experiment.id === 'cyber-name-dispute'
          ? ['Person[1].name']
          : ['Order[1].amount'];
      expect(differences).toEqual(expected);
      expect(experiment.changedFact.length).toBeGreaterThan(30);
      expect(experiment.confidenceSourceRef).toBeTruthy();
      expect(experiment.baselineConfidence).toBeGreaterThan(0.55);
      expect(experiment.alternativeConfidence).toBeGreaterThan(0.55);
      const baselinePrimary = experiment.baselineEvidence.filter(item => item.sourceRef === experiment.confidenceSourceRef);
      const alternativePrimary = experiment.alternativeEvidence.filter(item => item.sourceRef === experiment.confidenceSourceRef);
      expect(baselinePrimary.length).toBeGreaterThan(0);
      expect(alternativePrimary.length).toBeGreaterThan(0);
      expect(experiment.baselineEvidence.some(item => item.confidence === 0.55)).toBe(true);
      expect(experiment.alternativeEvidence.some(item => item.confidence === 0.55)).toBe(true);
    }
  });
});
