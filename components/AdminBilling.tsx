'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { getBillingConfig, saveBillingConfig } from '../src/services/localStorage';
import { BillingConfig } from '../src/types/storage';
import {
  Building2,
  Package,
  Truck,
  Settings,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDown,
  MapPin,
  Clock,
  FileText,
  Printer,
  Calendar,
} from 'lucide-react';

// --- Types for API response ---

interface DeliveryDetail {
  id: string;
  date: string;
  pickupDate: string;
  studioName?: string;
  pickupAddress: string;
  pickupTime: string;
  destination: string;
  deliveryAddress: string;
  deliveryPhone: string;
  deliveryTime: string;
  specialInstructions: string;
  generalNotes: string;
  status: string;
  billingClient: string;
}

interface PickupDetail {
  pickupDate: string;
  pickupAddress: string;
  pickupTime: string;
}

interface BillingClient {
  name: string;
  studios?: string[];
  email?: string;
  phone?: string;
  deliveries: number;
  pickups: number;
  totalServices?: number;
  dates: string[];
  pickupDetails?: PickupDetail[];
  deliveryDetails: DeliveryDetail[];
  billingClient: string;
}

interface BillingResponse {
  month: string;
  startDate?: string;
  endDate?: string;
  totalClients: number;
  totalDeliveries: number;
  totalPickups: number;
  totalServices?: number;
  clients: BillingClient[];
}

type PeriodPreset = 'month' | 'quarter' | 'semester' | 'year' | 'custom';

interface PeriodRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // Human-readable label
}

// --- Helpers ---

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const pad = (n: number): string => String(n).padStart(2, '0');

const toISO = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

const formatCurrency = (amount: number): string => {
  return `€${amount.toFixed(2)}`;
};

const escapeHtml = (s: string | undefined | null): string => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMonthIT = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-');
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return yyyymm;
  return `${MONTHS_IT[idx]} ${y}`;
};

const formatDateITFromISO = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const availableYears = (): number[] => {
  const currentYear = new Date().getFullYear();
  return [currentYear - 1, currentYear, currentYear + 1];
};

const computeRange = (
  preset: PeriodPreset,
  month: string,
  year: number,
  quarter: 1 | 2 | 3 | 4,
  semester: 1 | 2,
  customStart: string,
  customEnd: string
): PeriodRange => {
  if (preset === 'month') {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      startDate: toISO(start),
      endDate: toISO(end),
      label: formatMonthIT(month),
    };
  }
  if (preset === 'quarter') {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return {
      startDate: toISO(start),
      endDate: toISO(end),
      label: `Trimestre ${quarter} ${year} (${MONTHS_IT[startMonth]}–${MONTHS_IT[startMonth + 2]})`,
    };
  }
  if (preset === 'semester') {
    const startMonth = (semester - 1) * 6;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 6, 0);
    return {
      startDate: toISO(start),
      endDate: toISO(end),
      label: `Semestre ${semester} ${year} (${MONTHS_IT[startMonth]}–${MONTHS_IT[startMonth + 5]})`,
    };
  }
  if (preset === 'year') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return {
      startDate: toISO(start),
      endDate: toISO(end),
      label: `Anno ${year}`,
    };
  }
  // custom
  if (customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd,
      label: `${formatDateITFromISO(customStart)} – ${formatDateITFromISO(customEnd)}`,
    };
  }
  return { startDate: '', endDate: '', label: 'Personalizzato' };
};

const buildPrintHtml = (
  client: BillingClient,
  costPerService: number,
  periodLabel: string
): string => {
  const totalCost = client.deliveries * costPerService;
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const rows = [...(client.deliveryDetails || [])].sort((a, b) => {
    const dateA = (a.date || '').split('/').reverse().join('');
    const dateB = (b.date || '').split('/').reverse().join('');
    return dateB.localeCompare(dateA);
  });

  const rowsHtml = rows
    .map((d, i) => {
      const richiesta = escapeHtml(d.date);
      const ritiro = escapeHtml(d.pickupDate);
      const studio = escapeHtml(d.studioName || '');
      const indirizzoRitiro = escapeHtml((d.pickupAddress || '').replace(/\n/g, ', '));
      const destinatario = escapeHtml(d.destination);
      const indirizzoConsegna = escapeHtml((d.deliveryAddress || '').replace(/\n/g, ', '));
      const note = escapeHtml(d.specialInstructions || '');
      return `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${ritiro || richiesta}</td>
          <td>
            <div class="strong">${studio || '—'}</div>
            <div class="small">${indirizzoRitiro}</div>
          </td>
          <td>
            <div class="strong">${destinatario || '—'}</div>
            <div class="small">${indirizzoConsegna}</div>
            ${note ? `<div class="note">Note: ${note}</div>` : ''}
          </td>
          <td class="num">€ ${costPerService.toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  const studiosLine = (client.studios || []).length > 0
    ? `<div class="meta-row"><span class="meta-label">Studi collegati:</span> ${escapeHtml(client.studios!.join(', '))}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Riepilogo servizi ${escapeHtml(client.name)} - ${escapeHtml(periodLabel)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 0; font-size: 11pt; line-height: 1.4; }
  .header { border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-size: 20pt; font-weight: 700; letter-spacing: 0.5px; }
  .brand-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
  .doc-info { text-align: right; font-size: 9pt; color: #4b5563; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .meta { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; }
  .meta-row { margin: 2px 0; font-size: 10pt; }
  .meta-label { color: #6b7280; font-weight: 600; display: inline-block; min-width: 130px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5pt; }
  thead { display: table-header-group; }
  th { background: #1f2937; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tr:nth-child(even) td { background: #fafbfc; }
  .strong { font-weight: 600; color: #111827; }
  .small { color: #6b7280; font-size: 8.5pt; margin-top: 2px; }
  .note { color: #92400e; font-size: 8pt; margin-top: 4px; font-style: italic; }
  tfoot td { border-top: 2px solid #1f2937; border-bottom: none; padding-top: 10px; font-weight: 700; font-size: 11pt; }
  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 8.5pt; color: #6b7280; text-align: center; }
  .print-btn { position: fixed; top: 12px; right: 12px; background: #2563eb; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-size: 11pt; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #1d4ed8; }
  @media print { .print-btn { display: none; } body { font-size: 10pt; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Stampa / Salva come PDF</button>

  <div class="header">
    <div>
      <div class="brand">DRIVERS COMPANY S.C.</div>
      <div class="brand-sub">Via Oderzo 1, 33100 Udine · Tel 0432-526200</div>
    </div>
    <div class="doc-info">
      <div>Documento generato il ${today}</div>
      <div>Allegato alla fatturazione</div>
    </div>
  </div>

  <h1>Riepilogo servizi — ${escapeHtml(client.name)}</h1>

  <div class="meta">
    <div class="meta-row"><span class="meta-label">Periodo:</span> ${escapeHtml(periodLabel)}</div>
    <div class="meta-row"><span class="meta-label">Cliente / Committente:</span> <strong>${escapeHtml(client.name)}</strong></div>
    ${studiosLine}
    <div class="meta-row"><span class="meta-label">Servizi totali:</span> ${client.deliveries}</div>
    <div class="meta-row"><span class="meta-label">Costo per servizio:</span> € ${costPerService.toFixed(2)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Data ritiro</th>
        <th>Da (studio)</th>
        <th>Consegna a</th>
        <th class="num">Importo</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align: right;">TOTALE</td>
        <td class="num">€ ${totalCost.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    Drivers Company S.C. · Logistica Professionale · driverscompanysc@gmail.com
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 300);
    });
  </script>
</body>
</html>`;
};

const handlePrintClient = (
  client: BillingClient,
  costPerService: number,
  periodLabel: string
): void => {
  const html = buildPrintHtml(client, costPerService, periodLabel);
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) {
    alert('Impossibile aprire la finestra di stampa. Controlla i popup del browser.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
};


// --- Component ---

export const AdminBilling: React.FC = () => {
  const currentYear = new Date().getFullYear();

  // Period selection state
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  );
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(
    (new Date().getMonth() < 6 ? 1 : 2) as 1 | 2
  );
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [data, setData] = useState<BillingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [costPerService, setCostPerService] = useState(6.0);
  const [sortAlpha, setSortAlpha] = useState(true);

  const range: PeriodRange = useMemo(
    () => computeRange(periodPreset, selectedMonth, selectedYear, selectedQuarter, selectedSemester, customStart, customEnd),
    [periodPreset, selectedMonth, selectedYear, selectedQuarter, selectedSemester, customStart, customEnd]
  );

  // Load billing config from localStorage
  useEffect(() => {
    const config = getBillingConfig();
    if (config.costPerDelivery > 0) {
      setCostPerService(config.costPerDelivery);
    }
  }, []);

  const fetchBillingData = useCallback(async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://n8n.madani.agency/webhook/dental-logistics-billing?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }
      const result: BillingResponse = await response.json();
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`Impossibile caricare i dati di fatturazione: ${message}`);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData(range.startDate, range.endDate);
  }, [range.startDate, range.endDate, fetchBillingData]);

  const handleSaveCostConfig = () => {
    const config: BillingConfig = {
      costPerDelivery: costPerService,
      costPerPickup: 0,
      lastUpdated: new Date().toISOString(),
    };
    saveBillingConfig(config);
  };

  const periodSelector = (
    <PeriodSelector
      preset={periodPreset}
      onPresetChange={setPeriodPreset}
      selectedMonth={selectedMonth}
      onMonthChange={setSelectedMonth}
      selectedYear={selectedYear}
      onYearChange={setSelectedYear}
      selectedQuarter={selectedQuarter}
      onQuarterChange={setSelectedQuarter}
      selectedSemester={selectedSemester}
      onSemesterChange={setSelectedSemester}
      customStart={customStart}
      onCustomStartChange={setCustomStart}
      customEnd={customEnd}
      onCustomEndChange={setCustomEnd}
      periodLabel={range.label}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {periodSelector}
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-gray-500 font-medium">
            Caricamento dati di fatturazione...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {periodSelector}
        <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Errore di caricamento
            </h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button
              onClick={() => fetchBillingData(range.startDate, range.endDate)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-11"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || data.totalClients === 0) {
    return (
      <div className="space-y-6">
        {periodSelector}
        <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-10 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nessun dato disponibile
            </h3>
            <p className="text-gray-500">
              Non ci sono dati di fatturazione per il periodo selezionato.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = data.totalDeliveries * costPerService;

  return (
    <div className="space-y-6">
      {periodSelector}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Building2 className="h-6 w-6 text-blue-600" />}
          value={data.totalClients}
          label="Totale Clienti"
          bgClass="bg-blue-50"
          borderClass="border-blue-100"
        />
        <SummaryCard
          icon={<Package className="h-6 w-6 text-green-600" />}
          value={data.totalDeliveries}
          label="Totale Servizi"
          bgClass="bg-green-50"
          borderClass="border-green-100"
        />
        <SummaryCard
          icon={<Truck className="h-6 w-6 text-orange-600" />}
          value={data.totalPickups}
          label="Ritiri (informativo)"
          bgClass="bg-orange-50"
          borderClass="border-orange-100"
        />
        <SummaryCard
          icon={<span className="text-lg font-bold text-purple-600">€</span>}
          value={formatCurrency(totalRevenue)}
          label="Imponibile Totale"
          bgClass="bg-purple-50"
          borderClass="border-purple-100"
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConfig(!showConfig)}
          className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurazione Costi
        </Button>
      </div>

      {showConfig && (
        <Card className="bg-white shadow-lg border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">
              Configurazione Costi
            </h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1 w-full sm:w-auto">
                <label
                  htmlFor="costPerService"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Costo per servizio (€)
                </label>
                <Input
                  id="costPerService"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPerService}
                  onChange={(e) =>
                    setCostPerService(parseFloat(e.target.value) || 0)
                  }
                  className="rounded-xl border-2 border-gray-200 h-11 w-full sm:w-48"
                />
              </div>
              <Button
                onClick={handleSaveCostConfig}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6"
              >
                Salva
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Dettaglio Clienti
            </h2>
            <button
              onClick={() => setSortAlpha(!sortAlpha)}
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
            >
              {sortAlpha ? 'A→Z' : 'Per servizi'}
            </button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Cerca cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-2 border-gray-200 h-10 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            const sortedClients = [...data.clients].sort((a, b) =>
              sortAlpha
                ? a.name.localeCompare(b.name)
                : b.deliveries - a.deliveries
            );
            const filtered = sortedClients.filter((client) =>
              client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (client.studios || []).some((studio) =>
                studio.toLowerCase().includes(searchQuery.toLowerCase())
              )
            );
            if (filtered.length === 0) {
              return (
                <div className="col-span-full text-center py-10 text-gray-400">
                  Nessun cliente trovato per "{searchQuery}"
                </div>
              );
            }
            return filtered.map((client, index) => (
              <ClientCard
                key={`${client.name}-${index}`}
                client={client}
                costPerService={costPerService}
                periodLabel={range.label}
              />
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const PeriodSelector: React.FC<{
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedQuarter: 1 | 2 | 3 | 4;
  onQuarterChange: (q: 1 | 2 | 3 | 4) => void;
  selectedSemester: 1 | 2;
  onSemesterChange: (s: 1 | 2) => void;
  customStart: string;
  onCustomStartChange: (s: string) => void;
  customEnd: string;
  onCustomEndChange: (s: string) => void;
  periodLabel: string;
}> = ({
  preset,
  onPresetChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  selectedQuarter,
  onQuarterChange,
  selectedSemester,
  onSemesterChange,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  periodLabel,
}) => {
  const presets: { key: PeriodPreset; label: string }[] = [
    { key: 'month', label: 'Mese' },
    { key: 'quarter', label: 'Trimestre' },
    { key: 'semester', label: 'Semestre' },
    { key: 'year', label: 'Anno' },
    { key: 'custom', label: 'Personalizzato' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Fatturazione</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{periodLabel}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onPresetChange(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                preset === p.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'month' && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Mese:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        )}

        {preset === 'quarter' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Trimestre:</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onQuarterChange(q as 1 | 2 | 3 | 4)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    selectedQuarter === q
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  T{q}
                </button>
              ))}
            </div>
            <YearSelector value={selectedYear} onChange={onYearChange} />
          </div>
        )}

        {preset === 'semester' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Semestre:</label>
            <div className="flex gap-1">
              {[1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSemesterChange(s as 1 | 2)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    selectedSemester === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {s === 1 ? 'S1 (Gen–Giu)' : 'S2 (Lug–Dic)'}
                </button>
              ))}
            </div>
            <YearSelector value={selectedYear} onChange={onYearChange} />
          </div>
        )}

        {preset === 'year' && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Anno:</label>
            <YearSelector value={selectedYear} onChange={onYearChange} />
          </div>
        )}

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Dal:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Al:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const YearSelector: React.FC<{
  value: number;
  onChange: (year: number) => void;
}> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(parseInt(e.target.value, 10))}
    className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
  >
    {availableYears().map((y) => (
      <option key={y} value={y}>{y}</option>
    ))}
  </select>
);

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  value: string | number;
  label: string;
  bgClass: string;
  borderClass: string;
}> = ({ icon, value, label, bgClass, borderClass }) => (
  <Card
    className={`${bgClass} border ${borderClass} shadow-lg rounded-2xl overflow-hidden`}
  >
    <CardContent className="p-5">
      <div className="flex items-center gap-3 mb-3">{icon}</div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-900">
        {value}
      </div>
      <div className="text-sm text-gray-600 mt-1 font-medium">{label}</div>
    </CardContent>
  </Card>
);

const ClientCard: React.FC<{
  client: BillingClient;
  costPerService: number;
  periodLabel: string;
}> = ({ client, costPerService, periodLabel }) => {
  const totalCost = client.deliveries * costPerService;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-white shadow-lg border-0 rounded-2xl overflow-hidden hover:shadow-xl transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900">{client.name}</h3>
          {client.studios && client.studios.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Studi collegati: {client.studios.join(', ')}
            </p>
          )}
          {client.email && (
            <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>
          )}
          {client.phone && (
            <p className="text-sm text-gray-500">{client.phone}</p>
          )}
        </div>
        <button
          onClick={() => handlePrintClient(client, costPerService, periodLabel)}
          className="inline-flex items-center gap-1.5 mb-3 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
          aria-label={`Stampa riepilogo ${client.name}`}
        >
          <Printer className="h-3.5 w-3.5" />
          Stampa riepilogo
        </button>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Package className="h-3.5 w-3.5" />
            {client.deliveries} servizi
          </div>
          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Truck className="h-3.5 w-3.5" />
            {client.pickups} ritiri
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500 font-medium">
            Totale dovuto
          </span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(totalCost)}
          </span>
        </div>

        {client.deliveryDetails && client.deliveryDetails.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-between w-full text-left group"
            >
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Dettaglio servizi ({client.deliveryDetails.length})
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expanded && (
              <div className="mt-3 space-y-3">
                {client.pickupDetails && client.pickupDetails.length > 0 &&
                  client.pickupDetails.map((pickup, index) => (
                    <div
                      key={`${pickup.pickupDate}-${pickup.pickupAddress}-${index}`}
                      className="bg-orange-50 rounded-xl p-3.5 border border-orange-100"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-3.5 w-3.5 text-orange-600" />
                        <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                          Ritiro {client.pickupDetails && client.pickupDetails.length > 1 ? index + 1 : ''}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-orange-800">
                        {pickup.pickupAddress && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
                            <span>{pickup.pickupAddress}</span>
                          </div>
                        )}
                        {pickup.pickupTime && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                            <span>{pickup.pickupTime}</span>
                          </div>
                        )}
                        {pickup.pickupDate && (
                          <div className="flex items-center gap-2 text-xs text-orange-700 pt-1">
                            <span>Data ritiro: {pickup.pickupDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                {client.deliveryDetails.map((detail, i) => (
                  <div
                    key={detail.id || i}
                    className="bg-green-50 rounded-xl p-3.5 border border-green-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-sm font-semibold text-green-900">
                          {detail.destination || 'Consegna ' + (i + 1)}
                        </span>
                        {detail.studioName && (
                          <span className="text-xs text-gray-500 ml-1">({detail.studioName})</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {detail.deliveryAddress && (
                        <div className="flex items-start gap-2 text-green-800">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
                          <span>{detail.deliveryAddress}</span>
                        </div>
                      )}
                      {detail.deliveryTime && (
                        <div className="flex items-center gap-2 text-green-800">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          <span>{detail.deliveryTime}</span>
                        </div>
                      )}
                      {detail.specialInstructions && (
                        <div className="flex items-start gap-2 text-green-800">
                          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
                          <span>{detail.specialInstructions}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-1 text-xs text-green-600">
                        {detail.id && <span>{detail.id}</span>}
                        {detail.date && <span>Richiesta: {detail.date}</span>}
                        {detail.pickupDate && <span>Ritiro: {detail.pickupDate}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
