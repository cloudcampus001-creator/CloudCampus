/**
 * reportCardBuilder.js  —  src/lib/reportCardBuilder.js
 *
 * Shared report card HTML builder.
 * Used by VPReportCardsPage (view + print/download) and ParentReportCardPage (view only).
 *
 * Exports:
 *   fetchSchoolTemplate(schoolId)  → fetches ALL report_* fields from schools table
 *   buildCardHtml(params)          → returns complete HTML string
 *   computeSeqAvg / computeTermAvgForSubject / computeGeneralAvg
 *   fmt / getMention
 */
import { supabase } from '@/lib/customSupabaseClient';

/* ─── helpers ─────────────────────────────────────────────── */
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

/* ─── compute helpers ─────────────────────────────────────── */
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

/* ─── fetch full school template ─────────────────────────── */
export const fetchSchoolTemplate = async (schoolId) => {
  const { data, error } = await supabase
    .from('schools')
    .select(
      'name, address, phone, logo_url,' +
      'report_school_name, report_motto, report_address,' +
      'report_city, report_phone, report_email,' +
      'report_principal, report_vp_name,' +
      'report_logo_url, report_stamp_url, report_signature_url,' +
      'report_accent_color, report_show_stamp,' +
      'report_header_note, report_ministry_label'
    )
    .eq('id', +schoolId)
    .maybeSingle();

  if (error) console.warn('fetchSchoolTemplate error:', error.message);
  if (!data) return { name: 'CloudCampus School', accent: '#6366f1', showStamp: true };

  return {
    name:          data.report_school_name    || data.name      || 'CloudCampus School',
    motto:         data.report_motto          || '',
    address:       data.report_address        || data.address   || '',
    city:          data.report_city           || '',
    phone:         data.report_phone          || data.phone     || '',
    email:         data.report_email          || '',
    principal:     data.report_principal      || '',
    vpName:        data.report_vp_name        || '',
    logoUrl:       data.report_logo_url       || data.logo_url  || '',
    stampUrl:      data.report_stamp_url      || '',
    signatureUrl:  data.report_signature_url  || '',
    accent:        data.report_accent_color   || '#6366f1',
    showStamp:     data.report_show_stamp     !== false,
    headerNote:    data.report_header_note    || '',
    ministryLabel: data.report_ministry_label || '',
  };
};

/* ═══════════════════════════════════════════════════════
   buildCardHtml
   ─────────────────────────────────────────────────────
   Params:
     student         { name, matricule, date_of_birth?, gender? }
     template        result of fetchSchoolTemplate()
     year            { name }
     periodName      string
     periodType      'sequence' | 'term'
     subjectRows     [{ subject, coeff, seqAvgs: {[seqId]: avg|null}, avg }]
     scopeSequences  [{ id, name }]
     generalAvg      number | null
     rank            number | null
     totalStudents   number
     absences        { justified: number, unjustified: number }
     comment         { teacher_comment?, vp_comment?, conduct? } | null
     autoPrint       boolean — if true adds window.print() script (for VP download)
                               if false renders silently in iframe viewer (default)
═══════════════════════════════════════════════════════ */
export const buildCardHtml = ({
  student,
  template = {},
  year,
  periodName,
  periodType,
  subjectRows = [],
  scopeSequences = [],
  generalAvg,
  rank,
  totalStudents,
  absences = { justified: 0, unjustified: 0 },
  comment = null,
  autoPrint = false,
}) => {
  const {
    name: schoolName = 'CloudCampus School',
    motto = '',
    address = '',
    city = '',
    phone = '',
    email = '',
    principal = '',
    vpName = '',
    logoUrl = '',
    stampUrl = '',
    signatureUrl = '',
    accent = '#6366f1',
    showStamp = true,
    headerNote = '',
    ministryLabel = '',
  } = template;

  const avgColor  = generalAvg == null ? '#6b7280' : generalAvg >= 10 ? '#15803d' : '#dc2626';
  const rankStr   = rank ? `${rank}e / ${totalStudents}` : '—';
  const mention   = getMention(generalAvg);
  const dateStr   = new Date().toLocaleDateString('fr-FR');

  const contactParts = [
    city  && `📍 ${city}`,
    phone && `📞 ${phone}`,
    email && `✉ ${email}`,
  ].filter(Boolean);

  const seqHeaders = scopeSequences.map(s =>
    `<th style="text-align:center;min-width:56px;padding:4px 6px">${s.name}</th>`
  ).join('');

  const tableRows = subjectRows.map((row, i) => {
    const color = row.avg == null ? '#6b7280' : row.avg >= 10 ? '#15803d' : '#dc2626';
    const bg    = i % 2 === 0 ? '#fff' : '#f8fafc';
    const seqCells = scopeSequences.map(seq => {
      const v  = row.seqAvgs?.[seq.id];
      const c2 = v == null ? '#6b7280' : v >= 10 ? '#15803d' : '#dc2626';
      return `<td style="text-align:center;color:${c2};font-weight:600;padding:4px 6px;border:1px solid #d1d5db;background:${bg}">${v != null ? v.toFixed(2) : '—'}</td>`;
    }).join('');
    return `
      <tr>
        <td style="padding:4px 8px;border:1px solid #d1d5db;background:${bg};font-weight:500">${row.subject}</td>
        <td style="text-align:center;padding:4px 6px;border:1px solid #d1d5db;background:${bg};color:#6b7280">${row.coeff}</td>
        ${seqCells}
        <td style="text-align:center;color:${color};font-weight:700;padding:4px 6px;border:1px solid #d1d5db;background:${bg};font-size:12px">${row.avg != null ? row.avg.toFixed(2) : '—'}</td>
        <td style="text-align:center;color:${color};padding:4px 6px;border:1px solid #d1d5db;background:${bg};font-size:10px">${getMention(row.avg)}</td>
      </tr>`;
  }).join('');

  const dobStr = student?.date_of_birth
    ? `<span style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px"><b>Né(e) le :</b> ${new Date(student.date_of_birth).toLocaleDateString('fr-FR')}</span>`
    : '';

  // VP signature cell — includes stamp and signature images if available
  const vpSignatureContent = [
    `<div style="font-weight:700;color:#374151;margin-bottom:3px">${vpName || 'Censeur / Proviseur'}</div>`,
    showStamp && stampUrl     ? `<img src="${stampUrl}" style="max-height:40px;max-width:75px;object-fit:contain;display:block;margin:3px auto" onerror="this.style.display='none'">` : '',
    showStamp && signatureUrl ? `<img src="${signatureUrl}" style="max-height:30px;max-width:75px;object-fit:contain;display:block;margin:2px auto" onerror="this.style.display='none'">` : '',
    principal ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px">${principal}</div>` : '',
  ].filter(Boolean).join('');

  const printScript = autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},700);});</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bulletin — ${student?.name || ''} — ${periodName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #1f2937;
    background: #fff;
    padding: 14mm 16mm;
  }
  /* ── header ── */
  .hdr { text-align: center; border-bottom: 3px solid ${accent}; padding-bottom: 12px; margin-bottom: 12px; }
  .ministry { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
  .school-name { font-size: 17px; font-weight: 900; color: ${accent}; letter-spacing: 1px; text-transform: uppercase; }
  .motto { font-size: 10px; font-style: italic; color: #6b7280; margin-top: 3px; }
  .header-note { font-size: 9px; color: #9ca3af; margin-top: 2px; }
  .contact-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 5px; font-size: 10px; color: #9ca3af; }
  /* ── title bar ── */
  .title-bar {
    background: ${accent};
    color: #fff;
    text-align: center;
    padding: 5px 8px;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 10px 0 8px;
    border-radius: 3px;
  }
  /* ── student info ── */
  .info-grid { display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; margin-bottom: 8px; }
  .info-grid span { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 3px; padding: 2px 7px; }
  /* ── stats row ── */
  .stats { display: flex; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; margin: 7px 0; }
  .stat { flex: 1; text-align: center; padding: 7px 3px; border-right: 1px solid #d1d5db; }
  .stat:last-child { border-right: none; }
  .stat-v { font-size: 17px; font-weight: 900; line-height: 1.1; color: ${accent}; }
  .stat-l { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  /* ── marks table ── */
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; }
  thead th { border: 1px solid #d1d5db; background: ${accent}; color: #fff; font-weight: 700; padding: 4px 7px; }
  .gen-row td { background: #eef2ff !important; font-weight: 700; }
  /* ── comments ── */
  .cmts { display: flex; gap: 7px; margin-top: 9px; }
  .cmt { flex: 1; border: 1px solid #d1d5db; border-radius: 3px; padding: 6px; min-height: 44px; font-size: 10px; }
  .clbl { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  /* ── signatures ── */
  .sigs { display: flex; gap: 8px; margin-top: 15px; }
  .sig { flex: 1; border-top: 1px solid #d1d5db; padding-top: 5px; text-align: center; font-size: 10px; color: #6b7280; }
  @media print {
    @page { size: A4; margin: 12mm; }
    body { padding: 0; }
  }
</style>
</head>
<body>

<!-- ═══ HEADER ═══ -->
<div class="hdr">
  ${ministryLabel ? `<div class="ministry">${ministryLabel}</div>` : ''}
  ${logoUrl ? `<img src="${logoUrl}" style="max-height:58px;max-width:120px;object-fit:contain;display:block;margin:0 auto 6px" onerror="this.style.display='none'">` : ''}
  <div class="school-name">${schoolName}</div>
  ${motto      ? `<div class="motto">"${motto}"</div>` : ''}
  ${headerNote ? `<div class="header-note">${headerNote}</div>` : ''}
  ${contactParts.length ? `<div class="contact-row">${contactParts.map(p => `<span>${p}</span>`).join('')}</div>` : ''}
</div>

<div class="title-bar">BULLETIN DE NOTES — ${periodType === 'sequence' ? 'SÉQUENCE' : 'TRIMESTRE / SEMESTRE'}</div>

<!-- ═══ STUDENT INFO ═══ -->
<div class="info-grid">
  <span><b>Élève :</b> ${student?.name || '—'}</span>
  <span><b>Matricule :</b> ${student?.matricule || '—'}</span>
  ${dobStr}
  <span><b>Période :</b> ${periodName}</span>
  <span><b>Année scolaire :</b> ${year?.name || '—'}</span>
  <span><b>Date d'émission :</b> ${dateStr}</span>
</div>

<!-- ═══ STATS ═══ -->
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
    <div class="stat-v">${absences.justified}h</div>
    <div class="stat-l">Abs. Justif.</div>
  </div>
  <div class="stat">
    <div class="stat-v" style="color:${absences.unjustified > 0 ? '#dc2626' : '#1f2937'}">${absences.unjustified}h</div>
    <div class="stat-l">Abs. Injust.</div>
  </div>
  <div class="stat">
    <div class="stat-v" style="font-size:${mention.length > 8 ? '11px' : '15px'}">${mention}</div>
    <div class="stat-l">Mention</div>
  </div>
</div>

<!-- ═══ MARKS TABLE ═══ -->
<table>
  <thead>
    <tr>
      <th style="text-align:left;min-width:115px;padding:4px 8px">Matière</th>
      <th style="text-align:center;width:38px;padding:4px 6px">Coef.</th>
      ${seqHeaders}
      <th style="text-align:center;min-width:65px;padding:4px 6px">Moy. Période</th>
      <th style="text-align:center;min-width:72px;padding:4px 6px">Mention</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    <tr class="gen-row">
      <td colspan="${2 + scopeSequences.length}" style="padding:5px 8px;border:1px solid #d1d5db">
        MOYENNE GÉNÉRALE
      </td>
      <td style="text-align:center;color:${avgColor};font-size:13px;border:1px solid #d1d5db;padding:5px 6px;font-weight:900">
        ${fmt(generalAvg)}/20
      </td>
      <td style="text-align:center;border:1px solid #d1d5db;padding:5px 6px;font-weight:700">${mention}</td>
    </tr>
  </tbody>
</table>

<!-- ═══ COMMENTS ═══ -->
<div class="cmts">
  <div class="cmt">
    <div class="clbl">Appréciation du Prof. Principal / Titulaire</div>
    <div>${comment?.teacher_comment || ''}</div>
  </div>
  <div class="cmt">
    <div class="clbl">Appréciation du Censeur / Proviseur</div>
    <div>${comment?.vp_comment || ''}</div>
  </div>
  <div class="cmt" style="max-width:130px">
    <div class="clbl">Conduite</div>
    <div style="font-size:11px;font-weight:700;margin-top:2px">${comment?.conduct || '—'}</div>
  </div>
</div>

<!-- ═══ SIGNATURES ═══ -->
<div class="sigs">
  <div class="sig">
    <div>Signature du Parent / Tuteur</div>
    <div style="margin-top:24px;border-top:1px dashed #d1d5db;padding-top:4px;font-size:9px;color:#d1d5db">Nom &amp; Signature</div>
  </div>
  <div class="sig">
    <div>Prof. Principal / Titulaire</div>
    <div style="margin-top:24px;border-top:1px dashed #d1d5db;padding-top:4px;font-size:9px;color:#d1d5db">Nom &amp; Signature</div>
  </div>
  <div class="sig">
    ${vpSignatureContent}
  </div>
</div>

${printScript}
</body>
</html>`;
};
