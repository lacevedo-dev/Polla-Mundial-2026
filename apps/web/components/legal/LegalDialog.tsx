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
            <DialogContent className="w-full px-5 pb-5 pt-4 sm:max-w-xl sm:px-7 sm:pb-7 sm:pt-6">
                <div className="flex items-start justify-between gap-4">
                    <DialogHeader className="min-w-0 flex-1">
                        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-100 text-lime-700">
                            <ScrollText className="h-5 w-5" />
                        </div>
                        <DialogTitle>{document.title}</DialogTitle>
                        <DialogDescription>
                            {document.summary}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogIconClose aria-label={`Cerrar ${document.title}`} className="shrink-0" />
                </div>

                <div className="mt-5 space-y-3 sm:mt-6">
                    {document.sections.map((section) => (
                        <section
                            key={section.heading}
                            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                        >
                            <h4 className="text-xs font-black uppercase tracking-[0.16em] text-slate-900">
                                {section.heading}
                            </h4>
                            <div className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                                {section.body.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
