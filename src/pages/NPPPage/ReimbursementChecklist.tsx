import { useLocale } from '@/i18n/LocaleContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { nppGuideContent } from './nppContent';
import { useChecklistProgress } from './useChecklistProgress';
import type { ChecklistItem } from './types';

const checklistSection = nppGuideContent.sections.find(
  (section) => section.id === 'reimbursement-checklist',
);

const checklistUi = {
  en: {
    reset: 'Reset',
    print: 'Print',
    progress: (completed: number, total: number) => `${completed} of ${total} complete`,
  },
  fr: {
    reset: 'Réinitialiser',
    print: 'Imprimer',
    progress: (completed: number, total: number) => `${completed} sur ${total} terminées`,
  },
} as const;

export const ReimbursementChecklist = () => {
  const { locale } = useLocale();
  const { completed, setItem, reset } = useChecklistProgress('reimbursement-checklist');
  const ui = checklistUi[locale];
  const total = nppGuideContent.checklist.length;
  const completedCount = completed.size;

  const handleCheckedChange = (id: ChecklistItem['id'], checked: boolean) => {
    setItem(id, checked);
  };

  return (
    <section aria-labelledby="reimbursement-checklist-heading" className="space-y-4">
      <div>
        <h2 id="reimbursement-checklist-heading" className="text-xl font-semibold">
          {checklistSection?.heading[locale] ??
            (locale === 'fr'
              ? 'Liste de contrôle pour le remboursement'
              : 'Reimbursement checklist')}
        </h2>
        {checklistSection?.paragraphs[0] && (
          <p className="mt-2 text-sm text-muted-foreground">
            {checklistSection.paragraphs[0][locale]}
          </p>
        )}
      </div>

      <p role="status" aria-live="polite" className="font-medium">
        {ui.progress(completedCount, total)}
      </p>

      <div className="space-y-3">
        {nppGuideContent.checklist.map((item) => {
          const label = item.label[locale];

          return (
            <label
              key={item.id}
              htmlFor={`reimbursement-${item.id}`}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring"
            >
              <Checkbox
                id={`reimbursement-${item.id}`}
                checked={completed.has(item.id)}
                aria-label={label}
                onCheckedChange={(checked) => handleCheckedChange(item.id, checked === true)}
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={reset}>
          {ui.reset}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => window.print()}>
          {ui.print}
        </Button>
      </div>
    </section>
  );
};

export default ReimbursementChecklist;
