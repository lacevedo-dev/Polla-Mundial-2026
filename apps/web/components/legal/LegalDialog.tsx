import { ScrollText } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogIconClose,
    DialogTitle,
} from '../ui/dialog';
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from './legal-documents';

type LegalDialogProps = {
    documentKey: LegalDocumentKey | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function LegalDialog({ documentKey, open, onOpenChange }: LegalDialogProps) {
    if (!documentKey) {
        return null;
    }

    const document = LEGAL_DOCUMENTS[documentKey];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-full px-5 pb-5 pt-4 sm:max-w-2xl sm:px-8 sm:pb-8 sm:pt-6"
                aria-describedby={`${documentKey}-legal-description`}
            >
                <div className="flex items-start justify-between gap-4">
                    <DialogHeader className="min-w-0 flex-1">
                        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-100 text-lime-700">
                            <ScrollText className="h-5 w-5" />
                        </div>
                        <DialogTitle>{document.title}</DialogTitle>
                        <DialogDescription id={`${documentKey}-legal-description`}>
                            {document.summary}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogIconClose aria-label={`Cerrar ${document.title}`} className="shrink-0" />
                </div>

                <div className="mt-5 overflow-y-auto pr-1 sm:mt-6" style={{ maxHeight: 'min(60vh, 34rem)' }}>
                    <div className="space-y-5">
                        {document.sections.map((section) => (
                            <section
                                key={section.heading}
                                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5"
                            >
                                <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                                    {section.heading}
                                </h4>
                                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                                    {section.body.map((paragraph) => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
