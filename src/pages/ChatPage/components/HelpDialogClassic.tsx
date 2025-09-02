import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';

// Step 7.2: Define HelpDialog props interface
interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HelpDialogClassic: React.FC<HelpDialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto glass border-[var(--border)] bg-[var(--card)]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <HelpCircle size={24} className="text-[var(--primary)]" />
            Policy Assistant Help
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)] text-base">
            Learn how to effectively use the Policy Assistant for your administrative needs.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 text-[var(--text)]">
          {/* What it does */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-[var(--primary)]">What is the Policy Assistant?</h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              The Policy Assistant is an AI-powered guide designed to help you navigate policies, procedures, and administrative requirements. 
              It can answer questions about regulations, benefits, claims, travel procedures, and more.
            </p>
          </div>


          {/* Available Knowledge Base */}
          <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2 text-[var(--primary)]">Current Knowledge Base</h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              This Policy Assistant has comprehensive knowledge about:
            </p>
            <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">
              <li>• <strong className="text-[var(--text)]">CFTDTI</strong> - Canadian Forces Temporary Duty Travel Instructions</li>
              <li>• <strong className="text-[var(--text)]">NJC Travel Directive</strong> - National Joint Council Travel Directive</li>
              <li>• <strong className="text-[var(--text)]">CBI</strong> - Compensation and Benefits Instructions</li>
            </ul>
          </div>
          {/* Question types */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-[var(--primary)]">What can you ask about?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-[var(--text)]">Travel & Claims</h4>
                <ul className="text-base sm:text-sm text-[var(--text-secondary)] space-y-1">
                  <li>• Travel duty (TD) claims</li>
                  <li>• Expense reimbursements</li>
                  <li>• Travel allowances</li>
                  <li>• Accommodation policies</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-[var(--text)]">Administrative</h4>
                <ul className="text-base sm:text-sm text-[var(--text-secondary)] space-y-1">
                  <li>• Unit procedures</li>
                  <li>• Forms and applications</li>
                  <li>• Contact information</li>
                  <li>• Regulations and directives</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-[var(--text)]">General Inquiries</h4>
                <ul className="text-base sm:text-sm text-[var(--text-secondary)] space-y-1">
                  <li>• Policy clarifications</li>
                  <li>• Process explanations</li>
                  <li>• Document requirements</li>
                  <li>• Timeline questions</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Example questions */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-[var(--primary)]">Example Questions</h3>
            <div className="bg-[var(--background-secondary)] rounded-lg p-4 space-y-2">
              <div className="text-base sm:text-sm text-[var(--text-secondary)]">
                <p>• "What are the TD claim requirements for travel over 12 hours?"</p>
                <p>• "How do I submit a claim for meal expenses during travel?"</p>
                <p>• "What documents do I need for a posting allowance?"</p>
                <p>• "Who do I contact for FSC services at my unit?"</p>
                <p>• "What is the maximum accommodation rate for TD travel?"</p>
                <p>• "How long does it take to process a benefits claim?"</p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-[var(--primary)]">Tips for Better Results</h3>
            <div className="space-y-2 text-[var(--text-secondary)]">
              <p>• <strong>Be specific:</strong> Include details like timeframes, amounts, or specific policies</p>
              <p>• <strong>Ask follow-up questions:</strong> If you need clarification, don't hesitate to ask for more details</p>
              <p>• <strong>Use clear language:</strong> Simple, direct questions often get the best responses</p>
              <p>• <strong>Check sources:</strong> Review the provided sources for official documentation</p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-orange-600 dark:text-orange-400 mt-0.5">⚠️</div>
              <div className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Important:</strong> Always verify critical information with official sources or your unit's administrative staff. 
                This assistant provides guidance but should not replace official policy documents.
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};