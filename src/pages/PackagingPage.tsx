import { useState, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SKU {
  kod: string
  desc: string
  l: number
  w: number
  h: number
  vol: number
  pkg: string
  fill: string
  flag: string
  notes: string
}

// ── Constants ──────────────────────────────────────────────────────────────────
const FLAG_CONFIG: Record<string, { color: string; bg: string }> = {
  '✅ OK':           { color: '#16a34a', bg: '#f0fdf4' },
  '⚠️ OVERPACK':    { color: '#b45309', bg: '#fffbeb' },
  '🔴 ΔΕΝ ΧΩΡΑΕΙ':  { color: '#dc2626', bg: '#fef2f2' },
  '🥃 ΕΎΘΡΑΥΣΤΟ':   { color: '#7c3aed', bg: '#f5f3ff' },
  '📚 ΒΙΒΛΙΟ':      { color: '#1d4ed8', bg: '#eff6ff' },
}

const PKG_CONFIG: Record<string, { color: string; bg: string }> = {
  'F6':  { color: '#0891b2', bg: '#ecfeff' },
  'SK':  { color: '#7c3aed', bg: '#f5f3ff' },
  'C1':  { color: '#16a34a', bg: '#f0fdf4' },
  'C11': { color: '#1d4ed8', bg: '#eff6ff' },
  'C2':  { color: '#d97706', bg: '#fffbeb' },
  'C3':  { color: '#db2777', bg: '#fdf2f8' },
  'C4':  { color: '#7c3aed', bg: '#f5f3ff' },
  'C5':  { color: '#dc2626', bg: '#fef2f2' },
  'C9':  { color: '#059669', bg: '#ecfdf5' },
  '🔴 ΔΕΝ ΧΩΡΑΕΙ': { color: '#dc2626', bg: '#fef2f2' },
}

const BOX_NAMES: Record<string, string> = {
  'F6':  'Φάκελος Νο6 340×220×25',
  'SK':  'Σακούλα Courier 550×450×25',
  'C1':  'Κουτί Μικρό 200×140×90',
  'C11': 'Κουτί Βιβλίου 320×230×60',
  'C2':  'Κουτί Μεσαίο 300×240×90',
  'C3':  'Κουτί Τετράγωνο 300×300×150',
  'C4':  'Κουτί Μεγάλο Τετρ. 450×350×250',
  'C5':  'Κουτί Μεγάλο 570×400×470',
  'C9':  'Κουτί Μακρόστενο 550×200×200',
}

const PAGE_SIZE = 50

// ── Main Component ─────────────────────────────────────────────────────────────
export function PackagingPage() {
  const [allData, setAllData] = useState<SKU[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [flagFilter, setFlagFilter] = useState('all')
  const [pkgFilter, setPkgFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<SKU | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load Excel file
  async function handleFile(file: File) {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as any[][]

      const skus: SKU[] = []
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        if (!r[0]) continue
        skus.push({
          kod:   String(r[0] || ''),
          desc:  String(r[1] || ''),
          l:     Number(r[2]) || 0,
          w:     Number(r[3]) || 0,
          h:     Number(r[4]) || 0,
          vol:   Number(r[5]) || 0,
          pkg:   String(r[6] || ''),
          fill:  String(r[7] || ''),
          flag:  String(r[8] || ''),
          notes: String(r[9] || ''),
        })
      }
      setAllData(skus)
      setLoaded(true)
      setPage(1)
    } catch (e) {
      alert('Σφάλμα ανάγνωσης αρχείου')
    }
    setLoading(false)
  }

  // Filter
  const filtered = allData.filter(s => {
    const matchSearch = search === '' ||
      s.kod.toLowerCase().includes(search.toLowerCase()) ||
      s.desc.toLowerCase().includes(search.toLowerCase())
    const matchFlag = flagFilter === 'all' || s.flag === flagFilter
    const matchPkg  = pkgFilter === 'all'  || s.pkg === pkgFilter
    return matchSearch && matchFlag && matchPkg
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stats
  const stats = allData.reduce((acc, s) => {
    acc[s.pkg] = (acc[s.pkg] || 0) + 1
    acc[s.flag] = (acc[s.flag] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const selectStyle: React.CSSProperties = {
    border: '0.5px solid #e5e5e5', borderRadius: 20,
    padding: '6px 14px', fontSize: 12, outline: 'none',
    fontFamily: 'Inter, sans-serif', color: '#1a1a1a',
    background: 'white', cursor: 'pointer',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#f5f5f0', fontFamily:'Inter,sans-serif' }}>

      {/* Header */}
      <div style={{ background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'16px 24px', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Αποθήκη</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: loaded ? 14 : 0 }}>
          <div style={{ fontSize:24, fontWeight:500, color:'#1a1a1a' }}>Συσκευασία SKUs</div>
          <button onClick={() => fileRef.current?.click()}
            style={{ background:'#1a1a1a', color:'white', border:'none', padding:'8px 18px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer' }}>
            {loading ? 'Φόρτωση...' : '⬆️ Upload packaging_v3.xlsx'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display:'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        {/* Stats pills */}
        {loaded && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <div style={{ fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:4 }}>
              <strong style={{ color:'#1a1a1a' }}>{allData.length.toLocaleString()}</strong> SKUs σύνολο
            </div>
            {Object.entries(PKG_CONFIG).slice(0,9).map(([pkg, cfg]) => {
              const count = stats[pkg] || 0
              if (!count) return null
              return (
                <div key={pkg} onClick={() => setPkgFilter(pkgFilter === pkg ? 'all' : pkg)}
                  style={{ display:'flex', alignItems:'center', gap:5, background: pkgFilter===pkg ? cfg.color : cfg.bg,
                    borderRadius:20, padding:'4px 10px', cursor:'pointer', transition:'all 0.15s' }}>
                  <span style={{ fontSize:10, fontWeight:500, color: pkgFilter===pkg ? 'white' : cfg.color }}>{pkg}</span>
                  <span style={{ fontSize:10, fontWeight:700, color: pkgFilter===pkg ? 'white' : cfg.color }}>{count.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload prompt */}
      {!loaded && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
          <div style={{ fontSize:48 }}>📦</div>
          <div style={{ fontSize:16, fontWeight:500, color:'#1a1a1a' }}>Ανέβασε το packaging_v3.xlsx</div>
          <div style={{ fontSize:13, color:'#9ca3af' }}>Το αρχείο με τα 143,682 SKUs και τις συστάσεις συσκευασίας</div>
          <div onClick={() => fileRef.current?.click()}
            style={{ background:'#1a1a1a', color:'white', padding:'10px 24px', borderRadius:20, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            {loading ? 'Φόρτωση...' : 'Επιλογή αρχείου'}
          </div>
        </div>
      )}

      {/* Filters */}
      {loaded && (
        <div style={{ background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'10px 24px', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          {/* Search */}
          <div style={{ position:'relative', flex:1, maxWidth:320 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#9ca3af' }}>🔍</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Αναζήτηση κωδικού ή περιγραφής..."
              style={{ ...selectStyle, width:'100%', paddingLeft:34, borderRadius:8, padding:'7px 12px 7px 34px' }} />
          </div>

          {/* Flag filter */}
          <select value={flagFilter} onChange={e => { setFlagFilter(e.target.value); setPage(1) }} style={selectStyle}>
            <option value="all">Όλα τα flags</option>
            <option value="✅ OK">✅ OK</option>
            <option value="⚠️ OVERPACK">⚠️ Overpack</option>
            <option value="🔴 ΔΕΝ ΧΩΡΑΕΙ">🔴 Δεν χωράει</option>
            <option value="🥃 ΕΎΘΡΑΥΣΤΟ">🥃 Εύθραυστο</option>
            <option value="📚 ΒΙΒΛΙΟ">📚 Βιβλίο</option>
          </select>

          {/* Pkg filter */}
          <select value={pkgFilter} onChange={e => { setPkgFilter(e.target.value); setPage(1) }} style={selectStyle}>
            <option value="all">Όλες οι συσκευασίες</option>
            {Object.entries(BOX_NAMES).map(([code, name]) => (
              <option key={code} value={code}>{code} — {name.split(' ').slice(0,2).join(' ')}</option>
            ))}
          </select>

          <span style={{ fontSize:12, color:'#9ca3af', marginLeft:'auto' }}>
            {filtered.length.toLocaleString()} αποτελέσματα
          </span>
        </div>
      )}

      {/* Table */}
      {loaded && (
        <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>
          <div style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', overflow:'hidden' }}>

            {/* Table header */}
            <div style={{ display:'grid', gridTemplateColumns:'110px 1fr 80px 90px 100px 100px 80px', padding:'10px 16px', background:'#f9f9f7', borderBottom:'0.5px solid #e5e5e5' }}>
              {['Κωδικός','Περιγραφή','Διαστάσεις','Όγκος','Συσκευασία','Flag','Γέμισμα%'].map(h => (
                <div key={h} style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, fontWeight:600 }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {paginated.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:13 }}>Δεν βρέθηκαν αποτελέσματα</div>
            ) : paginated.map((sku, i) => {
              const pkgCfg  = PKG_CONFIG[sku.pkg]  || { color:'#6b7280', bg:'#f9f9f7' }
              const flagCfg = FLAG_CONFIG[sku.flag] || { color:'#6b7280', bg:'#f9f9f7' }
              return (
                <div key={sku.kod + i} onClick={() => setSelected(sku)}
                  style={{ display:'grid', gridTemplateColumns:'110px 1fr 80px 90px 100px 100px 80px',
                    padding:'10px 16px', alignItems:'center',
                    borderBottom: i < paginated.length-1 ? '0.5px solid #f9f9f7' : 'none',
                    cursor:'pointer', transition:'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                >
                  <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', fontFamily:'monospace' }}>{sku.kod}</div>
                  <div style={{ fontSize:12, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:12 }}>{sku.desc}</div>
                  <div style={{ fontSize:11, color:'#6b7280', fontFamily:'monospace' }}>{sku.l}×{sku.w}×{sku.h}</div>
                  <div style={{ fontSize:11, color:'#6b7280', fontFamily:'monospace' }}>{sku.vol?.toFixed(3)} lt</div>
                  <div>
                    <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:pkgCfg.bg, color:pkgCfg.color }}>
                      {sku.pkg}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize:10, fontWeight:500, padding:'3px 8px', borderRadius:20, background:flagCfg.bg, color:flagCfg.color }}>
                      {sku.flag.replace('⚠️ ','').replace('✅ ','').replace('🔴 ','').replace('🥃 ','').replace('📚 ','')}
                    </span>
                  </div>
                  <div style={{ fontSize:11, fontFamily:'monospace', color:'#6b7280' }}>{sku.fill}</div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:16 }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                style={{ border:'0.5px solid #e5e5e5', background:'white', padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', color: page===1 ? '#d1d5db' : '#1a1a1a' }}>
                ← Πριν
              </button>
              <span style={{ fontSize:12, color:'#6b7280' }}>
                Σελίδα {page} από {totalPages.toLocaleString()} ({filtered.length.toLocaleString()} αποτελέσματα)
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                style={{ border:'0.5px solid #e5e5e5', background:'white', padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', color: page===totalPages ? '#d1d5db' : '#1a1a1a' }}>
                Επόμενο →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={() => setSelected(null)}>
          <div style={{ background:'white', borderRadius:16, width:480, boxShadow:'0 24px 64px rgba(0,0,0,0.15)', border:'0.5px solid #e5e5e5', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ padding:'18px 20px', borderBottom:'0.5px solid #f0f0f0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4, fontFamily:'monospace' }}>{selected.kod}</div>
                <div style={{ fontSize:15, fontWeight:500, color:'#1a1a1a', lineHeight:1.4 }}>{selected.desc}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer', padding:'0 4px' }}>×</button>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }}>
              {[
                { label:'Μήκος', val:`${selected.l} mm` },
                { label:'Πλάτος', val:`${selected.w} mm` },
                { label:'Ύψος', val:`${selected.h} mm` },
              ].map(({ label, val }, i) => (
                <div key={label} style={{ padding:'14px 16px', borderBottom:'0.5px solid #f0f0f0', borderRight: i<2 ? '0.5px solid #f0f0f0' : 'none' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 }}>{label}</div>
                  <div style={{ fontSize:15, fontWeight:500, color:'#1a1a1a', fontFamily:'monospace' }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }}>
              {[
                { label:'Όγκος', val:`${selected.vol?.toFixed(3)} lt` },
                { label:'Γέμισμα', val:selected.fill },
                { label:'Συσκευασία', val:selected.pkg, color: (PKG_CONFIG[selected.pkg]||{}).color },
              ].map(({ label, val, color }, i) => (
                <div key={label} style={{ padding:'14px 16px', borderBottom:'0.5px solid #f0f0f0', borderRight: i<2 ? '0.5px solid #f0f0f0' : 'none' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 }}>{label}</div>
                  <div style={{ fontSize:15, fontWeight:500, color: color || '#1a1a1a', fontFamily:'monospace' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Box name */}
            <div style={{ padding:'14px 20px', borderBottom:'0.5px solid #f0f0f0' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Κουτί/Συσκευασία</div>
              <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{BOX_NAMES[selected.pkg] || selected.pkg}</div>
            </div>

            {/* Flag + Notes */}
            <div style={{ padding:'14px 20px' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Status</div>
              <span style={{ fontSize:11, fontWeight:500, padding:'4px 12px', borderRadius:20,
                background: (FLAG_CONFIG[selected.flag]||{bg:'#f9f9f7'}).bg,
                color: (FLAG_CONFIG[selected.flag]||{color:'#6b7280'}).color }}>
                {selected.flag}
              </span>
              {selected.notes && (
                <div style={{ fontSize:12, color:'#6b7280', marginTop:10 }}>{selected.notes}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
