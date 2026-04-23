/**
 * reportCardBuilder.js
 * Shared utility — builds printable report card HTML.
 * Used by both VPReportCardsPage (VP preview + distribute)
 * and ParentReportCardPage (on-demand PDF generation).
 *
 * fetchSchoolTemplate(schoolId)  → fetches all report_* fields
 * buildCardHtml(params)          → returns full HTML string
 */
import { supabase } from '@/lib/customSupabaseClient';

/* ── helpers ──────────────────────────────────────────── */
export const fmt   = (n) => n != null ? Number(n).toFixed(2) : '—';
export const round = (n) => n != null ? Math.round(n * 100) / 100 : null;

export const getMention = (avg) => {
  if (avg == null) return '—';
  if (avg >= 18) return 'Excellent';
  if (avg >= 16) return 'Très Bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez Bien';
  if (avg >= 10) return 'Passable';
  return 'Insuffisant';
};

/* ── Compute helpers ─────────────────────────────────── */
export const computeSeqAvg = (marks, seqId, subject) => {
  const r = marks.filter(m => m.sequence_id === seqId && m.subject === subject);
  if (!r.length) return null;
  const vals = r.map(m => (m.mark / (m.total_marks || 20)) * 20);
  return round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

export const computeTermAvgForSubject = (marks, sequences, termId, subject) => {
  const seqs = sequences.filter(s => s.term_id === termId);
  const avgs = seqs.map(s => computeSeqAvg(marks, s.id, subject)).filter(v => v != null);
  return avgs.length ? round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
};

export const computeGeneralAvg = (subjectAvgs, coeffMap) => {
  let tw = 0, tc = 0;
  Object.entries(subjectAvgs).forEach(([subj, avg]) => {
    if (avg == null) return;
    const c = coeffMap[subj] || 1;
    tw += avg * c; tc += c;
  });
  return tc === 0 ? null : round(tw / tc);
};

/* ── Fetch complete school template ──────────────────── */
export const fetchSchoolTemplate = async (schoolId) => {
  const { data } = await supabase
    .from('schools')
    .select([
      'name', 'address', 'phone', 'logo_url',
      'report_school_name', 'report_motto', 'report_address',
      'report_city', 'report_phone', 'report_email',
      'report_principal', 'report_vp_name',
      'report_logo_url', 'report_stamp_url', 'report_signature_url',
      'report_accent_color', 'report_show_stamp',
      'report_header_note', 'report_ministry_label',
    ].join(','))
    .eq('id', +schoolId)
    .maybeSingle();

  if (!data) return { name: 'CloudCampus School', accent: '#6366f1' };

  return {
    // Displayed values — fall back from report_* → raw school fields
    name:           data.report_school_name    || data.name           || 'CloudCampus School',
    motto:          data.report_motto          || '',
    address:        data.report_address        || data.address        || '',
    city:           data.report_city           || '',
    phone:          data.report_phone          || data.phone          || '',
    email:          data.report_email          || '',
    principal:      data.report_principal      || '',
    vpName:         data.report_vp_name        || '',
    logoUrl:        data.report_logo_url       || data.logo_url       || '',
    stampUrl:       data.report_stamp_url      || '',
    signatureUrl:   data.report_signature_url  || '',
    accent:         data.report_accent_color   || '#6366f1',
    showStamp:      data.report_show_stamp     !== false,
    headerNote:     data.report_header_note    || '',
    ministryLabel:  data.report_ministry_label || '',
  };
};

/* ═══════════════════════════════════════════════════════
   buildCardHtml
   Params:
     student         { name, matricule, date_of_birth?, gender? }
     template        result of fetchSchoolTemplate()
     year            { name }
     periodName      string e.g. "Séquence 1"
     periodType      'sequence' | 'term'
     subjectRows     [{ subject, coeff, seqAvgs: {[seqId]: avg}, avg }]
     scopeSequences  [{ id, name }]
     generalAvg      number | null
     rank            number | null
     totalStudents   number
     absences        { justified: number, unjustified: number }
     comment         { teacher_comment, vp_comment, conduct } | null
═══════════════════════════════════════════════════════ */
export const buildCardHtml = ({
  student,
  template,
  year,
  periodName,
  periodType,
  subjectRows,
  scopeSequences,
  generalAvg,
  rank,
  totalStudents,
  absences,
  comment,
}) => {
  const {
    name: schoolName, motto, address, city, phone, email,
    principal, vpName, logoUrl, stampUrl, signatureUrl,
    accent = '#6366f1', showStamp = true, headerNote, ministryLabel,
  } = template || {};

  const avgColor  = generalAvg == null ? '#6b7280' : generalAvg >= 10 ? '#15803d' : '#dc2626';
  const rankStr   = rank ? `${rank}e / ${totalStudents}` : '—';
  const mention   = getMention(generalAvg);

  const seqHeaders = (scopeSequences || []).map(s =>
    `<th style="text-align:center;min-width:58px;padding:4px 7px">${s.name}</th>`
  ).join('');

  const rows = (subjectRows || []).map(row => {
    const color = row.avg == null ? '#6b7280' : row.avg >= 10 ? '#15803d' : '#dc2626';
    const seqCells = (scopeSequences || []).map(seq => {
      const v = row.seqAvgs?.[seq.id];
      const c2 = v == null ? '#6b7280' : v >= 10 ? '#15803d' : '#dc2626';
      return `<td style="text-align:center;color:${c2};font-weight:600;padding:4px 7px">${v != null ? v.toFixed(2) : '—'}</td>`;
    }).join('');
    return `
      <tr>
        <td style="padding:4px 8px;border:1px solid #d1d5db">${row.subject}</td>
        <td style="text-align:center;padding:4px 7px;border:1px solid #d1d5db">${row.coeff}</td>
        ${seqCells}
        <td style="text-align:center;color:${color};font-weight:700;padding:4px 7px;border:1px solid #d1d5db">${row.avg != null ? row.avg.toFixed(2) : '—'}</td>
        <td style="text-align:center;color:${color};padding:4px 7px;border:1px solid #d1d5db;font-size:11px">${getMention(row.avg)}</td>
      </tr>`;
  }).join('');

  const dob = student?.date_of_birth
    ? `<span><b>Né(e) le :</b> ${new Date(student.date_of_birth).toLocaleDateString('fr-FR')}</span>`
    : '';

  // Contact line
  const contactParts = [
    city    && `📍 ${city}`,
    phone   && `📞 ${phone}`,
    email   && `✉ ${email}`,
  ].filter(Boolean);

  // Signature cells
  const signatureCells = [
    { label: 'Signature du Parent / Tuteur', content: '' },
    { label: 'Prof. Principal / Titulaire',  content: '' },
    {
      label:   vpName || 'Censeur / Proviseur',
      content: [
        showStamp && stampUrl     ? `<img src="${stampUrl}" style="max-height:42px;max-width:80px;object-fit:contain;display:block;margin:4px auto 0" onerror="this.style.display='none'">` : '',
        showStamp && signatureUrl ? `<img src="${signatureUrl}" style="max-height:32px;max-width:80px;object-fit:contain;display:block;margin:2px auto 0" onerror="this.style.display='none'">` : '',
        principal ? `<div style="font-size:9px;color:#6b7280;margin-top:3px">${principal}</div>` : '',
      ].filter(Boolean).join(''),
    },
  ];

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin — ${student?.name || ''} — ${periodName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; padding: 14mm; }
  .hdr { text-align: center; border-bottom: 3px solid ${accent}; padding-bottom: 11px; margin-bottom: 11px; }
  .school { font-size: 16px; font-weight: 900; color: ${accent}; letter-spacing: 1px; text-transform: uppercase; }
  .title-bar { background: ${accent}; color: #fff; text-align: center; padding: 5px; font-weight: 700; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 9px 0 7px; border-radius: 3px; }
  .info-grid { display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; margin-bottom: 7px; }
  .info-grid span { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 3px; padding: 2px 6px; }
  .stats { display: flex; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; margin: 7px 0; }
  .stat { flex: 1; text-align: center; padding: 6px 3px; border-right: 1px solid #d1d5db; }
  .stat:last-child { border-right: none; }
  .stat-v { font-size: 16px; font-weight: 900; color: ${accent}; line-height: 1.1; }
  .stat-l { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; }
  th { border: 1px solid #d1d5db; background: ${accent}; color: #fff; font-weight: 700; padding: 4px 7px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .gen-row td { background: #eef2ff !important; font-weight: 700; }
  .cmts { display: flex; gap: 6px; margin-top: 8px; }
  .cmt { flex: 1; border: 1px solid #d1d5db; border-radius: 3px; padding: 5px; min-height: 42px; font-size: 10px; }
  .clbl { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .sigs { display: flex; gap: 7px; margin-top: 14px; }
  .sig { flex: 1; border-top: 1px solid #d1d5db; padding-top: 5px; text-align: center; font-size: 10px; color: #6b7280; }
  @media print { @page { size: A4; margin: 12mm; } body { padding: 0; } }
</style>
</head>
<body>

<div class="hdr">
  ${ministryLabel ? `<div style="font-size:9px;color:#6b7280;margin-bottom:5px;letter-spacing:1px;text-transform:uppercase">${ministryLabel}</div>` : ''}
  ${logoUrl ? `<img src="${logoUrl}" style="max-height:55px;max-width:120px;object-fit:contain;display:block;margin:0 auto 5px" onerror="this.style.display='none'">` : ''}
  <div class="school">${schoolName}</div>
  ${motto ? `<div style="font-size:10px;font-style:italic;color:#6b7280;margin-top:3px">"${motto}"</div>` : ''}
  ${headerNote ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px">${headerNote}</div>` : ''}
  ${contactParts.length ? `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:4px;font-size:10px;color:#9ca3af">${contactParts.map(p => `<span>${p}</span>`).join('')}</div>` : ''}
</div>

<div class="title-bar">BULLETIN DE NOTES — ${periodType === 'sequence' ? 'SÉQUENCE' : 'TRIMESTRE / SEMESTRE'}</div>

<div class="info-grid">
  <span><b>Élève :</b> ${student?.name || '—'}</span>
  <span><b>Matricule :</b> ${student?.matricule || '—'}</span>
  ${dob}
  <span><b>Période :</b> ${periodName}</span>
  <span><b>Année :</b> ${year?.name || '—'}</span>
  <span><b>Date d'émission :</b> ${new Date().toLocaleDateString('fr-FR')}</span>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-v" style="color:${avgColor}">${fmt(generalAvg)}/20</div>
    <div class="stat-l">Moy. Générale</div>
  </div>
  <div class="stat">
    <div class="stat-v">${rankStr}</div>
    <div class="stat-l">Rang</div>
  </div>
  <div class="stat">
    <div class="stat-v">${absences?.justified || 0}h</div>
    <div class="stat-l">Abs. Justif.</div>
  </div>
  <div class="stat">
    <div class="stat-v" style="color:${(absences?.unjustified || 0) > 0 ? '#dc2626' : '#1f2937'}">${absences?.unjustified || 0}h</div>
    <div class="stat-l">Abs. Injust.</div>
  </div>
  <div class="stat">
    <div class="stat-v" style="font-size:${mention.length > 8 ? '11px' : '14px'}">${mention}</div>
    <div class="stat-l">Mention</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="text-align:left;min-width:120px;padding:4px 8px">Matière</th>
      <th style="text-align:center;width:38px;padding:4px 7px">Coef</th>
      ${seqHeaders}
      <th style="text-align:center;min-width:68px;padding:4px 7px">Moy. Période</th>
      <th style="text-align:center;min-width:75px;padding:4px 7px">Mention</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="gen-row">
      <td colspan="${2 + (scopeSequences || []).length}" style="padding:5px 8px;border:1px solid #d1d5db">
        <b>MOYENNE GÉNÉRALE</b>
      </td>
      <td style="text-align:center;color:${avgColor};font-size:13px;border:1px solid #d1d5db;padding:5px 7px">
        <b>${fmt(generalAvg)}/20</b>
      </td>
      <td style="text-align:center;border:1px solid #d1d5db;padding:5px 7px"><b>${mention}</b></td>
    </tr>
  </tbody>
</table>

<div class="cmts">
  <div class="cmt">
    <div class="clbl">Appréciation du Prof. Principal</div>
    <div>${comment?.teacher_comment || ''}</div>
  </div>
  <div class="cmt">
    <div class="clbl">Appréciation du Censeur / Proviseur</div>
    <div>${comment?.vp_comment || ''}</div>
  </div>
  <div class="cmt" style="max-width:130px">
    <div class="clbl">Conduite</div>
    <b style="font-size:11px">${comment?.conduct || '—'}</b>
  </div>
</div>

<div class="sigs">
  ${signatureCells.map(({ label, content }) => `
    <div class="sig">
      <div>${label}</div>
      ${content}
    </div>`).join('')}
</div>

<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 600);
  });
</script>
</body>
</html>`;
};
