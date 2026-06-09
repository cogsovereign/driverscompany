'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FormData, Recipient } from '../types/form';
import { getSenderProfile, saveSenderProfile, saveRecipient } from '../services/localStorage';
import { defaultStructuredHours } from '../../components/StudioHoursSelector';
import {
  createNewRecipient,
  createRequestId,
  initialFormData,
  normalizeCommittenteName,
} from '../constants/formOptions';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StudioInformationStep } from '../../components/StudioInformationStep';
import { RecipientsDeliveryStep } from '../../components/RecipientsDeliveryStep';
import { SubmissionRecap } from '../../components/SubmissionRecap';
import { RequestCancellationView } from '../../components/RequestCancellationView';

import { AdminBilling } from '../../components/AdminBilling';
import { GestioneCommittenti } from '../../components/GestioneCommittenti';
import { ArrowLeft, ArrowRight, Package } from 'lucide-react';
import { isValidPhoneNumber } from 'libphonenumber-js';

const DentalLogisticsForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'form' | 'admin' | 'cancel'>('form');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminView, setAdminView] = useState<'billing' | 'committenti'>('billing');
  const [cancellationRequestId, setCancellationRequestId] = useState('');

  // Synchronous guard against double/triple-click submissions
  const submittingRef = useRef(false);
  // Persistent requestId per submission attempt - reused across retries to enable backend dedupe
  const persistentRequestIdRef = useRef<string>('');

  // Load sender profile from localStorage on mount
  useEffect(() => {
    const savedProfile = getSenderProfile();
    if (savedProfile) {
      setFormData(prev => ({
        ...prev,
        companyName: savedProfile.companyName,
        email: savedProfile.email,
        companyPhone: savedProfile.companyPhone,
        studioHours: savedProfile.studioHours,
        pickupLocation: savedProfile.pickupLocation,
        billingClient: normalizeCommittenteName(savedProfile.billingClient || ''),
      }));
    }
  }, []);

  // Detect cancellation URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const requestId = params.get('requestId');
    if (action === 'cancel' && requestId) {
      setCancellationRequestId(requestId);
      setViewMode('cancel');
      setIsSubmitted(false);
    }
  }, []);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone || phone.trim() === '') return false;
    
    try {
      // Use libphonenumber-js for proper validation
      return isValidPhoneNumber(phone);
    } catch (error) {
      return false;
    }
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      errors.companyName = 'Nome azienda obbligatorio';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email obbligatoria';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Formato email non valido';
    }

    if (!formData.companyPhone.trim()) {
      errors.companyPhone = 'Telefono obbligatorio';
    } else if (!validatePhone(formData.companyPhone)) {
      errors.companyPhone = 'Numero di telefono non valido';
    }

    if (!formData.studioHours.trim()) {
      errors.studioHours = 'Orari studio obbligatori';
    }

    if (!formData.pickupDate) {
      errors.pickupDate = 'Data ritiro obbligatoria';
    }

    if (!formData.pickupLocation.trim()) {
      errors.pickupLocation = 'Indirizzo ritiro obbligatorio';
    }

    if (!formData.billingClient.trim()) {
      errors.billingClient = 'Laboratorio committente obbligatorio';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    formData.recipients.forEach((recipient, index) => {
      if (!recipient.destination.trim()) {
        errors[`recipient-${index}-destination`] = 'Nome destinatario obbligatorio';
      }
      
      if (!recipient.shippingAddress.trim()) {
        errors[`recipient-${index}-address`] = 'Indirizzo consegna obbligatorio';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form navigation with validation
  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Form data handlers
  const handleInputChange = (field: keyof Omit<FormData, 'recipients'>, value: any) => {
    const nextValue = field === 'billingClient' && typeof value === 'string'
      ? normalizeCommittenteName(value)
      : value;

    setFormData(prev => ({ ...prev, [field]: nextValue }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }

    // Real-time validation for phone numbers
    if (field === 'companyPhone' && nextValue) {
      if (!validatePhone(nextValue)) {
        setValidationErrors(prev => ({
          ...prev,
          [field]: 'Formato telefono non valido'
        }));
      }
    }

    // Real-time validation for email
    if (field === 'email' && nextValue) {
      if (!validateEmail(nextValue)) {
        setValidationErrors(prev => ({
          ...prev,
          [field]: 'Formato email non valido'
        }));
      }
    }
  };

  // Recipient management
  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, createNewRecipient()]
    }));
  };

  const removeRecipient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter(recipient => recipient.id !== id)
    }));
  };

  const updateRecipient = (id: string, field: keyof Recipient, value: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map(recipient =>
        recipient.id === id ? { ...recipient, [field]: value } : recipient
      )
    }));

    // Clear validation errors for this recipient field
    const recipientIndex = formData.recipients.findIndex(r => r.id === id);
    const errorKey = `recipient-${recipientIndex}-${field === 'shippingAddress' ? 'address' : field}`;
    
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  };

  // Form submission
  const handleSubmit = async () => {
    if (!validateStep2()) {
      return;
    }

    // Synchronous double-click guard (runs BEFORE React re-renders the disabled button)
    if (submittingRef.current) {
      console.log('⏭️ Ignoring duplicate submit click (already in progress)');
      return;
    }
    submittingRef.current = true;

    // Generate the requestId ONCE per submission attempt and reuse on retries.
    // This enables backend dedupe: identical requestId from a double-submit
    // can be safely ignored by the workflow.
    if (!persistentRequestIdRef.current) {
      persistentRequestIdRef.current = createRequestId();
    }
    const requestId = persistentRequestIdRef.current;

    console.log('🚀 Starting form submission...', { requestId });
    setIsLoading(true);

    try {
      console.log('📋 Form data to submit:', formData);

      const n8nWebhookUrl = 'https://n8n.madani.agency/webhook/dental-logistics';
      console.log('📡 Sending to:', n8nWebhookUrl);

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, requestId }),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (response.ok) {
        const responseText = await response.text();
        console.log('✅ Response body:', responseText);
        console.log('✅ Form submitted successfully to n8n');
        setIsSubmitted(true);
        saveSenderProfile({
          companyName: formData.companyName,
          email: formData.email,
          companyPhone: formData.companyPhone,
          studioHours: formData.studioHours,
          structuredHours: defaultStructuredHours,
          pickupLocation: formData.pickupLocation,
          billingClient: normalizeCommittenteName(formData.billingClient),
          lastUpdated: new Date().toISOString(),
        });

        // Save recipients to address book
        formData.recipients.forEach(recipient => {
          saveRecipient({
            id: `REC_${Date.now()}_${recipient.id}`,
            destination: recipient.destination,
            phoneNumber: recipient.phoneNumber,
            shippingAddress: recipient.shippingAddress,
            deliveryTime: recipient.deliveryTime,
            specialInstructions: recipient.specialInstructions,
            lastUsed: new Date().toISOString(),
          });
        });


      } else {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error submitting form:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      alert(`Si è verificato un errore durante l'invio: ${errorMessage}\n\nControllare la console per dettagli.`);
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  // Reset form - clears all data and goes back to step 1
  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentStep(1);
    setIsSubmitted(false);
    setValidationErrors({});
    // Allow a fresh requestId for the next submission
    persistentRequestIdRef.current = '';
    submittingRef.current = false;
  };

  const handleBackToFormFromCancellation = () => {
    setViewMode('form');
    setCancellationRequestId('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      url.searchParams.delete('requestId');
      window.history.replaceState({}, '', url.toString());
    }
  };

  if (viewMode === 'cancel' && cancellationRequestId) {
    return (
      <RequestCancellationView
        requestId={cancellationRequestId}
        onBackToForm={handleBackToFormFromCancellation}
      />
    );
  }

  // Show submission recap if form is submitted
  if (isSubmitted) {
    return <SubmissionRecap data={formData} onReset={resetForm} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        {/* View Mode Navigation */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-full p-1 sm:p-1.5 shadow-lg border border-gray-100 inline-flex gap-0.5 sm:gap-1">
            <button
              onClick={() => setViewMode('form')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                viewMode === 'form'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Nuova Richiesta
            </button>

            <button
              onClick={() => {
                if (adminAuthenticated) {
                  setViewMode('admin');
                } else {
                  const pwd = window.prompt('Inserisci la password per accedere all\'amministrazione:');
                  if (pwd === 'Drivers123@') {
                    setAdminAuthenticated(true);
                    setViewMode('admin');
                  } else if (pwd !== null) {
                    alert('Password errata.');
                  }
                }
              }}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                viewMode === 'admin'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Amministrazione
            </button>

          </div>
        </div>

        {viewMode === 'form' && (
          <>
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img 
              src="/driverslogo.png" 
              alt="Drivers Logo" 
              className="h-16 sm:h-20 w-auto drop-shadow-sm"
            />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">
            Logistica Professionale Semplificata
          </h1>
          <p className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto mb-4 font-medium">
            <span className="text-gray-800 font-semibold">Risparmiate tempo prezioso.</span> Ritiamo dal vostro ufficio e consegniamo ovunque serva.
          </p>
          
          {/* Progress Indicator */}
          <div className="flex justify-center mt-4">
            <div className="bg-white rounded-full p-2 shadow-lg border border-gray-100">
              <div className="flex items-center space-x-6 text-sm sm:text-base px-4 py-2">
                <div className={`flex items-center transition-all duration-300 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-semibold transition-all duration-300 ${currentStep >= 1 ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                    1
                  </div>
                  <span className="hidden sm:inline font-medium">Informazioni Azienda</span>
                  <span className="sm:hidden font-medium">Azienda</span>
                </div>
                <div className={`w-12 h-0.5 transition-all duration-300 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <div className={`flex items-center transition-all duration-300 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-semibold transition-all duration-300 ${currentStep >= 2 ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                    2
                  </div>
                  <span className="hidden sm:inline font-medium">Destinazioni</span>
                  <span className="sm:hidden font-medium">Consegne</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
          {/* Step Content */}
          {currentStep === 1 && (
            <StudioInformationStep
              formData={formData}
              onInputChange={handleInputChange}
              validationErrors={validationErrors}
            />
          )}

          {currentStep === 2 && (
            <RecipientsDeliveryStep
              formData={formData}
              onInputChange={handleInputChange}
              onAddRecipient={addRecipient}
              onRemoveRecipient={removeRecipient}
              onUpdateRecipient={updateRecipient}
              validationErrors={validationErrors}
            />
          )}

          {/* Navigation */}
          <div className="border-t border-gray-100 p-4 sm:p-8 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
              {currentStep > 1 ? (
                <Button 
                  variant="outline" 
                  onClick={prevStep}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 h-16 px-10 w-full sm:w-auto rounded-xl text-lg font-medium transition-all duration-200"
                >
                  <ArrowLeft className="h-5 w-5 mr-3" />
                  Indietro
                </Button>
              ) : (
                <div className="hidden sm:block"></div>
              )}

              {currentStep < 2 ? (
                <div className="text-center w-full sm:w-auto">
                  <Button 
                    onClick={nextStep} 
                    className="bg-blue-600 hover:bg-blue-700 text-white h-16 px-10 text-lg font-semibold w-full sm:w-auto rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <span className="hidden sm:inline">Continua 👉</span>
                    <span className="sm:hidden">Continua 👉</span>
                    <ArrowRight className="h-5 w-5 ml-3" />
                  </Button>
                  <p className="text-sm text-gray-500 mt-4 font-medium">Completa tutti i campi per continuare</p>
                </div>
              ) : (
                <div className="text-center w-full sm:w-auto space-y-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white h-16 px-10 text-lg font-semibold w-full sm:w-auto rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {isLoading ? (
                      <>
                        <span className="hidden sm:inline">Invio in corso...</span>
                        <span className="sm:hidden">Invio...</span>
                        <div className="h-5 w-5 ml-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Invia richiesta ✅</span>
                        <span className="sm:hidden">Invia ✅</span>
                        <Package className="h-5 w-5 ml-3" />
                      </>
                    )}
                  </Button>
                  
                  <p className="text-sm text-gray-500 mt-4 font-medium">
                    {isLoading ? 'Elaborazione in corso...' : 'Vi contatteremo per confermare la richiesta'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
          </>
        )}



        {viewMode === 'admin' && (
          <div className="space-y-6">
            <div className="flex gap-2 bg-white rounded-2xl shadow-sm p-1.5 w-fit">
              <button
                onClick={() => setAdminView('billing')}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  adminView === 'billing'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Fatturazione
              </button>
              <button
                onClick={() => setAdminView('committenti')}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  adminView === 'committenti'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Gestione Committenti
              </button>
            </div>
            {adminView === 'billing' && <AdminBilling />}
            {adminView === 'committenti' && <GestioneCommittenti />}
          </div>
        )}


      </div>
    </div>
  );
};

export default DentalLogisticsForm; 
