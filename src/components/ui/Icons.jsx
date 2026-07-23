// Minimal inline SVG icon set. Stroke uses currentColor.
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconText = (p) => (<svg {...base} {...p}><path d="M4 7V5h16v2M9 5v14M7 19h4" /></svg>)
export const IconPhoto = (p) => (<svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>)
export const IconVideo = (p) => (<svg {...base} {...p}><rect x="2" y="5" width="14" height="14" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>)
export const IconDoc = (p) => (<svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>)
export const IconPin = (p) => (<svg {...base} {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>)
export const IconPlus = (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>)
export const IconClock = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
export const IconClose = (p) => (<svg {...base} {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>)
export const IconCheck = (p) => (<svg {...base} {...p}><path d="M20 6L9 17l-5-5" /></svg>)
export const IconTrash = (p) => (<svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>)
export const IconEdit = (p) => (<svg {...base} {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>)
export const IconBack = (p) => (<svg {...base} {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>)
export const IconSeed = (p) => (<svg {...base} {...p}><path d="M12 22V12M12 12c0-4 3-7 8-7 0 5-3 8-8 7zM12 14C12 10 9 8 4 8c0 4 3 6 8 6z" /></svg>)
export const IconUser = (p) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>)
export const IconLeaf = (p) => (<svg {...base} {...p}><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16zM5 20c4-6 7-8 12-9" /></svg>)
export const IconBook = (p) => (<svg {...base} {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 5v16" /></svg>)
export const IconHome = (p) => (<svg {...base} {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>)
export const IconStore = (p) => (<svg {...base} {...p}><path d="M4 4h16l-1 5H5zM5 9v11h14V9M9 20v-6h6v6" /></svg>)

export const SECTION_ICONS = {
  general: IconHome,
  agriculture: IconLeaf,
  education: IconBook,
  community: IconUser,
  commerce: IconStore,
}

export const MEDIA_ICONS = {
  text: IconText,
  photo: IconPhoto,
  video: IconVideo,
  document: IconDoc,
}
