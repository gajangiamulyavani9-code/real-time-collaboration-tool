const normalize = (value = '') => value.toLowerCase()

export const TEMPLATE_THEME_STYLES = {
  Resume: {
    card: 'bg-white/90 border-[#c9d4df] hover:border-[#5f7d99] hover:shadow-[0_18px_44px_rgba(55,70,84,0.12)]',
    icon: 'bg-[#e4edf4] text-[#476580]',
    badge: 'bg-[#e7eef5] text-[#425f7d]',
    accent: 'text-[#4f6f8a]',
    button: 'bg-[#486784] hover:bg-[#39546d] text-white',
    preview: 'border-[#d8e0e8] bg-[#f8f5ef] text-[#38424c]',
  },
  Wishes: {
    card: 'bg-white/90 border-[#e6d8d1] hover:border-[#b97b65] hover:shadow-[0_18px_44px_rgba(138,91,74,0.14)]',
    icon: 'bg-[#f5e8e0] text-[#9f6654]',
    badge: 'bg-[#f8ede7] text-[#94614f]',
    accent: 'text-[#b36f56]',
    button: 'bg-[#b57a62] hover:bg-[#9f6654] text-white',
    preview: 'border-[#eedfd7] bg-[#fff8f2] text-[#5d4a43]',
  },
  Notes: {
    card: 'bg-white/90 border-[#cfd8cf] hover:border-[#66846b] hover:shadow-[0_18px_44px_rgba(79,102,82,0.14)]',
    icon: 'bg-[#e2ebe3] text-[#5d7862]',
    badge: 'bg-[#e8f0e8] text-[#58715c]',
    accent: 'text-[#5b7660]',
    button: 'bg-[#617b66] hover:bg-[#516857] text-white',
    preview: 'border-[#d9e2da] bg-[#f7faf6] text-[#3f4b41]',
  },
  Tasks: {
    card: 'bg-white/90 border-[#ccdadd] hover:border-[#4f7f89] hover:shadow-[0_18px_44px_rgba(59,93,102,0.14)]',
    icon: 'bg-[#dfebee] text-[#4f7a84]',
    badge: 'bg-[#e5f0f2] text-[#4a7680]',
    accent: 'text-[#4d7c87]',
    button: 'bg-[#4e7a85] hover:bg-[#40656e] text-white',
    preview: 'border-[#d9e5e8] bg-[#f5f9fa] text-[#38484d]',
  },
  Work: {
    card: 'bg-white/90 border-[#d7d2c9] hover:border-[#8f7c55] hover:shadow-[0_18px_44px_rgba(92,80,54,0.12)]',
    icon: 'bg-[#eee8dc] text-[#78684a]',
    badge: 'bg-[#f2ecdf] text-[#726347]',
    accent: 'text-[#867250]',
    button: 'bg-[#7d6c4d] hover:bg-[#66583f] text-white',
    preview: 'border-[#e4ddcf] bg-[#fbf9f3] text-[#4d473c]',
  },
  Start: {
    card: 'bg-white/90 border-[#d7dce3] hover:border-[#5f7d99] hover:shadow-[0_18px_44px_rgba(55,70,84,0.12)]',
    icon: 'bg-[#e4edf4] text-[#476580]',
    badge: 'bg-[#e7eef5] text-[#425f7d]',
    accent: 'text-[#4f6f8a]',
    button: 'bg-[#486784] hover:bg-[#39546d] text-white',
    preview: 'border-[#d8e0e8] bg-[#f8f5ef] text-[#38424c]',
  },
}

export const getTemplateThemeStyles = (category = 'Start') =>
  TEMPLATE_THEME_STYLES[category] || TEMPLATE_THEME_STYLES.Start

export const inferDocumentTheme = (title = '') => {
  const value = normalize(title)

  if (value.includes('resume')) return 'resume'
  if (value.includes('birthday') || value.includes('wish')) return 'wishes'
  if (value.includes('note')) return 'notes'
  if (value.includes('todo') || value.includes('task')) return 'tasks'
  if (value.includes('proposal')) return 'work'
  return 'default'
}
