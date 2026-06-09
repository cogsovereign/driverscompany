'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle2, Loader2, Phone, RotateCcw } from 'lucide-react';

const CANCELLATION_WEBHOOK_URL = 'https://n8n.madani.agency/webhook/dental-logistics-cancel';
const DRIVERS_PHONE = '0432-526200';

type CancellationState =
  | 'confirm'
  | 'loading'
  | 'success'
  | 'success-urgent'
  | 'already-cancelled'
  | 'not-found'
  | 'error';

interface CancellationResponse {
  success?: boolean;
  message?: string;
  code?: string;
  isUrgent?: boolean;
}

interface RequestCancellationViewProps {
  requestId: string;
  onBackToForm: () => void;
}

export const RequestCancellationView: React.FC<RequestCancellationViewProps> = ({
  requestId,
  onBackToForm,
}) => {
  const [state, setState] = useState<CancellationState>('confirm');
  const [message, setMessage] = useState('');

  const headline = useMemo(() => {
    switch (state) {
      case 'success':
        return 'Richiesta annullata';
      case 'success-urgent':
        return 'Richiesta annullata - Chiamaci subito';
      case 'already-cancelled':
        return 'Richiesta già annullata';
      case 'not-found':
        return 'Richiesta non trovata';
      case 'error':
        return 'Errore durante l’annullamento';
      default:
        return 'Annulla richiesta di ritiro';
    }
  }, [state]);

  const description = useMemo(() => {
    if (message && state !== 'success-urgent' && state !== 'success') {
      return message;
    }
    switch (state) {
      case 'success':
        return 'Abbiamo registrato l’annullamento. Drivers Company è stata avvisata automaticamente.';
      case 'success-urgent':
        return 'Abbiamo registrato l’annullamento, ma il ritiro era previsto per oggi o nelle prossime ore. Il driver potrebbe già essere in viaggio.';
      case 'already-cancelled':
        return 'Questa richiesta risulta già annullata. Non è necessario procedere ulteriormente.';
      case 'not-found':
        return 'Non siamo riusciti a trovare la richiesta collegata a questo link. Verifica di aver aperto il link più recente, oppure contatta Drivers Company.';
      case 'error':
        return 'Si è verificato un problema tecnico. Ti invitiamo a contattare Drivers Company al numero indicato.';
      default:
        return 'Stai per annullare questa richiesta di ritiro. Dopo la conferma, Drivers Company riceverà una notifica automatica.';
    }
  }, [message, state]);

  const handleCancellation = async () => {
    setState('loading');
    setMessage('');

    try {
      const response = await fetch(CANCELLATION_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId }),
      });

      const responseText = await response.text();
      let parsed: CancellationResponse = {};

      if (responseText) {
        try {
          parsed = JSON.parse(responseText) as CancellationResponse;
        } catch {
          parsed = { message: responseText };
        }
      }

      if (response.ok && parsed.success !== false) {
        setState(parsed.isUrgent ? 'success-urgent' : 'success');
        setMessage('');
        return;
      }

      switch (parsed.code) {
        case 'ALREADY_CANCELLED':
          setState('already-cancelled');
          break;
        case 'NOT_FOUND':
          setState('not-found');
          break;
        default:
          setState('error');
          break;
      }
      setMessage(parsed.message || 'Non è stato possibile completare l’annullamento.');
    } catch {
      setState('error');
      setMessage('Non è stato possibile contattare il servizio di annullamento. Verifica la connessione internet e riprova.');
    }
  };

  const isUrgentSuccess = state === 'success-urgent';
  const isError =
    state === 'already-cancelled' || state === 'not-found' || state === 'error';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 sm:p-6 flex items-center justify-center">
      <Card className="w-full max-w-2xl bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-white text-center space-y-3 pt-8 pb-6">
          <div
            className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
              isUrgentSuccess
                ? 'bg-amber-50 text-amber-600'
                : state === 'success'
                ? 'bg-green-50 text-green-600'
                : isError
                ? 'bg-red-50 text-red-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {state === 'loading' ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : state === 'success' ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : isUrgentSuccess || isError ? (
              <AlertCircle className="h-8 w-8" />
            ) : (
              <RotateCcw className="h-8 w-8" />
            )}
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900">{headline}</CardTitle>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-lg mx-auto">
            {description}
          </p>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-700">
            <div className="font-semibold text-gray-900 mb-1">Riferimento richiesta</div>
            <div className="break-all font-mono text-xs sm:text-sm text-gray-600">{requestId}</div>
          </div>

          {state === 'confirm' && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-2">
                    <div className="font-bold text-amber-900">Attenzione</div>
                    <p className="text-amber-900 leading-relaxed">
                      Se il ritiro è previsto per oggi o nelle prossime ore, il driver potrebbe
                      <strong> già essere in viaggio</strong>. In quel caso, per essere certi
                      che l’annullamento arrivi in tempo, chiama direttamente Drivers Company:
                    </p>
                    <a
                      href={`tel:${DRIVERS_PHONE.replace(/-/g, '')}`}
                      className="inline-flex items-center gap-2 mt-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-base no-underline"
                    >
                      <Phone className="h-4 w-4" />
                      {DRIVERS_PHONE}
                    </a>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCancellation}
                className="w-full bg-red-600 hover:bg-red-700 text-white h-14 rounded-xl text-base sm:text-lg font-semibold"
              >
                Conferma annullamento
              </Button>

              <Button
                onClick={onBackToForm}
                variant="outline"
                className="w-full border-2 border-gray-200 hover:bg-gray-50 h-12 rounded-xl text-sm text-gray-700"
              >
                Torna indietro
              </Button>
            </div>
          )}

          {state === 'loading' && (
            <div className="text-center text-sm text-gray-500">
              Stiamo annullando la richiesta...
            </div>
          )}

          {isUrgentSuccess && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-3">
                    <div className="font-bold text-amber-900 text-base">
                      Per sicurezza, chiama subito Drivers Company
                    </div>
                    <p className="text-sm text-amber-900 leading-relaxed">
                      Il driver potrebbe essere già partito o in viaggio. Confermare l’annullamento
                      per telefono garantisce che il ritiro venga davvero fermato in tempo.
                    </p>
                    <a
                      href={`tel:${DRIVERS_PHONE.replace(/-/g, '')}`}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-lg no-underline shadow-md"
                    >
                      <Phone className="h-5 w-5" />
                      {DRIVERS_PHONE}
                    </a>
                  </div>
                </div>
              </div>

              <Button
                onClick={onBackToForm}
                variant="outline"
                className="w-full border-2 border-gray-200 hover:bg-gray-50 h-12 rounded-xl text-sm text-gray-700"
              >
                Torna alla home
              </Button>
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-3">
              <Button
                onClick={onBackToForm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl"
              >
                Torna alla home
              </Button>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Phone className="h-4 w-4" />
                Per assistenza: {DRIVERS_PHONE}
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-3">
              <Button
                onClick={onBackToForm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl"
              >
                Torna alla home
              </Button>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-700 font-medium">
                <Phone className="h-4 w-4" />
                Per assistenza chiama: <a href={`tel:${DRIVERS_PHONE.replace(/-/g, '')}`} className="text-blue-700 font-bold underline">{DRIVERS_PHONE}</a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
