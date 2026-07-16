'use client';

import React, { useState, useEffect } from 'react';
import { getSubmissions, clearSubmissions } from '../src/services/localStorage';
import { SavedSubmission } from '../src/types/storage';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  History,
  ChevronDown,
  ChevronUp,
  Package,
  Building2,
  Trash2,
  Calendar,
  Users,
} from 'lucide-react';

const formatDate = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

const formatDeliveryTime = (time: string): string => {
  switch (time) {
    case 'standard':
      return 'Standard: Entro le 18:00';
    case 'morning':
      return 'Mattina: 8:00-12:00';
    case 'afternoon':
      return 'Pomeriggio: 14:00-18:00';
    default:
      return time;
  }
};

export const SubmissionHistory: React.FC = () => {
  const [submissions, setSubmissions] = useState<SavedSubmission[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSubmissions(getSubmissions());
  }, []);

  const handleClear = () => {
    if (window.confirm('Sei sicuro di voler cancellare tutto lo storico delle richieste?')) {
      clearSubmissions();
      setSubmissions([]);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Empty state
  if (submissions.length === 0) {
    return (
      <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-10 text-center">
          <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nessuna richiesta precedente
          </h3>
          <p className="text-gray-500">
            Le tue richieste appariranno qui dopo il primo invio.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Storico Richieste</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {submissions.length}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Cancella storico
        </Button>
      </div>

      {/* Submission Cards */}
      <div className="space-y-4">
        {submissions.map((submission) => {
          const isExpanded = expandedId === submission.id;

          return (
            <Card
              key={submission.id}
              className="bg-white shadow-lg border-0 rounded-2xl overflow-hidden hover:shadow-xl transition-shadow duration-200"
            >
              <CardContent className="p-0">
                {/* Summary row */}
                <button
                  onClick={() => toggleExpand(submission.id)}
                  className="w-full text-left p-5 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-gray-900 truncate">
                        {submission.formData.companyName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(submission.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                      <Users className="h-3.5 w-3.5" />
                      {submission.recipientCount}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                      <div>
                        <strong className="text-gray-500">Email:</strong>{' '}
                        <span className="text-gray-800">{submission.formData.email}</span>
                      </div>
                      <div>
                        <strong className="text-gray-500">Telefono:</strong>{' '}
                        <span className="text-gray-800">{submission.formData.companyPhone}</span>
                      </div>
                      <div>
                        <strong className="text-gray-500">Data Ritiro:</strong>{' '}
                        <span className="text-gray-800">{submission.formData.pickupDate}</span>
                      </div>
                      <div>
                        <strong className="text-gray-500">Indirizzo Ritiro:</strong>{' '}
                        <span className="text-gray-800">{submission.formData.pickupLocation}</span>
                      </div>
                    </div>

                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Destinatari ({submission.formData.recipients.length})
                    </h4>
                    <div className="space-y-3">
                      {submission.formData.recipients.map((recipient, index) => (
                        <div
                          key={recipient.id || index}
                          className="bg-gray-50 rounded-xl p-3.5 border border-gray-100"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-sm font-semibold text-gray-900">
                              {recipient.destination}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>
                              <strong className="text-gray-500">Indirizzo:</strong>{' '}
                              {recipient.shippingAddress}
                            </p>
                            <p>
                              <strong className="text-gray-500">Orario:</strong>{' '}
                              {formatDeliveryTime(recipient.deliveryTime)}
                            </p>
                            {recipient.specialInstructions && (
                              <p>
                                <strong className="text-gray-500">Istruzioni:</strong>{' '}
                                {recipient.specialInstructions}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
