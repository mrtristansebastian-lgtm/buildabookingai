import { useMemo, useState } from 'react';
import {
  Briefcase,
  Camera,
  Check,
  Clock,
  DollarSign,
  Edit3,
  Image,
  Plus,
  Search,
  Tag,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { formatServiceDuration, formatServicePrice, normalizeService, normalizeServiceList } from '../utils/services';

const blankService = (overrides = {}) => normalizeService({
  name: 'New Service',
  category: '',
  description: '',
  price: '',
  currency: 'R',
  priceType: 'fixed',
  duration: '',
  staffIds: [],
  imageUrls: [],
  active: true,
  ...overrides
});

const priceTypes = [
  { id: 'fixed', label: 'Fixed' },
  { id: 'from', label: 'From' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'quote', label: 'Quote' }
];

const serviceStatusFilters = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'hidden', label: 'Hidden' }
];

const getStaffInitial = (staff = {}) => (staff.name || staff.email || 'S').charAt(0).toUpperCase();

export const ServicesStudio = ({
  settings,
  staffList = [],
  onUpdateSettings,
  canManageWorkspace = true,
  showToast
}) => {
  const services = useMemo(() => normalizeServiceList(settings?.services || []), [settings?.services]);
  const staffOptions = useMemo(
    () => staffList.length ? staffList : [{ id: 'owner', name: 'Owner', color: '#755CFF' }],
    [staffList]
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(() => blankService());
  const [galleryInput, setGalleryInput] = useState('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  const categoryOptions = useMemo(() => {
    const categories = services
      .map(service => String(service.category || '').trim())
      .filter(Boolean);
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
  }, [services]);

  const filteredServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return services.filter(service => {
      const serviceStaffIds = Array.isArray(service.staffIds) ? service.staffIds : [];
      const matchesSearch = !normalizedQuery || [
        service.name,
        service.category,
        service.description,
        service.price,
        service.duration,
        service.priceType
      ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'live' && service.active !== false)
        || (statusFilter === 'hidden' && service.active === false);
      const matchesCategory = categoryFilter === 'all' || String(service.category || '').trim() === categoryFilter;
      const matchesStaff = staffFilter === 'all'
        || (staffFilter === 'unassigned' ? serviceStaffIds.length === 0 : serviceStaffIds.includes(staffFilter));
      return matchesSearch && matchesStatus && matchesCategory && matchesStaff;
    });
  }, [categoryFilter, query, services, staffFilter, statusFilter]);

  const saveSettings = async (nextServices, message = 'Services saved.') => {
    const nextSettings = {
      ...settings,
      services: normalizeServiceList(nextServices)
    };
    await onUpdateSettings?.(nextSettings, message);
  };

  const openCreateService = () => {
    const nextService = blankService({
      category: categoryFilter !== 'all' ? categoryFilter : '',
      staffIds: staffFilter !== 'all' && staffFilter !== 'unassigned' ? [staffFilter] : []
    });
    setSelectedId(nextService.id);
    setDraft(nextService);
    setGalleryInput('');
    setIsServiceModalOpen(true);
  };

  const openServiceFile = (service) => {
    const normalized = normalizeService(service);
    setSelectedId(normalized.id);
    setDraft(normalized);
    setGalleryInput('');
    setIsServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setIsServiceModalOpen(false);
    setGalleryInput('');
  };

  const saveDraft = async () => {
    const cleaned = normalizeService(draft);
    if (!cleaned.name.trim()) {
      showToast?.('Give this service a name first.');
      return;
    }
    const exists = services.some(service => service.id === cleaned.id);
    const nextServices = exists
      ? services.map(service => service.id === cleaned.id ? cleaned : service)
      : [cleaned, ...services];
    setSelectedId(cleaned.id);
    await saveSettings(nextServices, `${cleaned.name} saved.`);
    closeServiceModal();
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    const nextServices = services.filter(service => service.id !== draft.id);
    setSelectedId('');
    setDraft(blankService());
    await saveSettings(nextServices, 'Service removed.');
    closeServiceModal();
  };

  const updateDraft = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  const toggleStaff = (staffId) => {
    setDraft(prev => {
      const current = Array.isArray(prev.staffIds) ? prev.staffIds : [];
      return {
        ...prev,
        staffIds: current.includes(staffId)
          ? current.filter(id => id !== staffId)
          : [...current, staffId]
      };
    });
  };

  const addGalleryUrl = () => {
    const url = galleryInput.trim();
    if (!url) return;
    setDraft(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), url] }));
    setGalleryInput('');
  };

  const handleGalleryUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), String(reader.result || '')] }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const removeGalleryImage = (index) => {
    setDraft(prev => ({
      ...prev,
      imageUrls: (prev.imageUrls || []).filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const selectedServiceExists = services.some(service => service.id === draft.id);

  return (
    <div className="services-studio space-y-5">
      <header className="dashboard-page-header mb-4 md:mb-6">
        <div>
          <h2 className="text-4xl md:text-4xl font-bold tracking-tight text-black">Services</h2>
          <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">
            Build the bookable menu clients choose from. Manage prices, durations, categories, galleries, and the staff who can deliver each service.
          </p>
        </div>
      </header>

      <section className="service-desk-shell rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="service-desk-command p-4 md:p-5 border-b border-neutral-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400">Services Desk</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-black mt-1">Bookable services</h2>
            <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
              Search, filter, and open a service file without spreading the whole setup across the page.
            </p>
          </div>
        </div>

        <div className="p-4 md:p-5 border-b border-neutral-100 space-y-3">
          <div className="flex flex-col xl:flex-row gap-3">
            <label className="service-search-field h-12 rounded-xl bg-neutral-50 border border-neutral-200 px-4 flex items-center gap-2 flex-1 min-w-0">
              <Search size={16} className="text-neutral-400 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search service, category, price, note"
                className="bg-transparent outline-none text-sm font-bold text-black placeholder:text-neutral-400 min-w-0 flex-1"
              />
            </label>
            <button
              type="button"
              onClick={openCreateService}
              disabled={!canManageWorkspace}
              className="native-gradient-button h-12 px-5 rounded-xl text-black text-[10px] font-black uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 shadow-xl shadow-black/10 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Plus size={14} /> New Service
            </button>
          </div>

          <div className="service-filter-rail flex flex-wrap items-center gap-2">
            {serviceStatusFilters.map(filter => {
              const active = statusFilter === filter.id;
              const count = filter.id === 'all'
                ? services.length
                : filter.id === 'live'
                  ? services.filter(service => service.active !== false).length
                  : services.filter(service => service.active === false).length;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={`h-10 px-3 rounded-lg text-[10px] font-black uppercase transition-all inline-flex items-center gap-2 ${active ? 'bg-black text-white shadow-lg shadow-black/10' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'}`}
                >
                  {filter.label}
                  <span className={`min-w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${active ? 'native-gradient-icon text-black' : 'bg-white text-black border border-neutral-100'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid xl:grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={14} />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Categories</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`h-9 px-3 rounded-full text-[10px] font-black uppercase tracking-[0.12em] ${categoryFilter === 'all' ? 'bg-black text-white' : 'bg-white text-neutral-500 border border-neutral-100'}`}
                >
                  All
                </button>
                {categoryOptions.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`h-9 px-3 rounded-full text-[10px] font-black uppercase tracking-[0.12em] ${categoryFilter === category ? 'bg-black text-white' : 'bg-white text-neutral-500 border border-neutral-100'}`}
                  >
                    {category}
                  </button>
                ))}
                {categoryOptions.length === 0 && (
                  <span className="h-9 px-3 rounded-full bg-white border border-dashed border-neutral-200 inline-flex items-center text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
                    Add categories from a service file
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Staff</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStaffFilter('all')}
                  className={`h-9 px-3 rounded-full text-[10px] font-black uppercase tracking-[0.12em] ${staffFilter === 'all' ? 'bg-black text-white' : 'bg-white text-neutral-500 border border-neutral-100'}`}
                >
                  All staff
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilter('unassigned')}
                  className={`h-9 px-3 rounded-full text-[10px] font-black uppercase tracking-[0.12em] ${staffFilter === 'unassigned' ? 'bg-black text-white' : 'bg-white text-neutral-500 border border-neutral-100'}`}
                >
                  Unassigned
                </button>
                {staffOptions.map(staff => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setStaffFilter(staff.id)}
                    className={`h-9 pl-1.5 pr-3 rounded-full text-[10px] font-black uppercase tracking-[0.12em] inline-flex items-center gap-2 ${staffFilter === staff.id ? 'bg-black text-white' : 'bg-white text-neutral-500 border border-neutral-100'}`}
                  >
                    <span
                      className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-black"
                      style={{ background: staffFilter === staff.id ? '#ffffff22' : `${staff.color || '#755CFF'}22`, color: staffFilter === staff.id ? '#fff' : staff.color || '#755CFF' }}
                    >
                      {getStaffInitial(staff)}
                    </span>
                    {staff.name || 'Staff'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="service-desk-list divide-y divide-neutral-100">
          {filteredServices.length === 0 ? (
            <div className="p-8 md:p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 inline-flex items-center justify-center mb-4">
                <Briefcase size={22} />
              </div>
              <h3 className="text-xl font-black text-black">{services.length ? 'No matching services' : 'No services yet'}</h3>
              <p className="text-sm text-neutral-500 mt-2 max-w-md mx-auto">
                {services.length ? 'Try another search, category, staff member, or status.' : 'Create your first service so the booking page has something clients can choose.'}
              </p>
              <button
                type="button"
                onClick={openCreateService}
                disabled={!canManageWorkspace}
                className="mt-5 h-11 px-5 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus size={14} /> Create Service
              </button>
            </div>
          ) : filteredServices.map(service => {
            const assignedStaff = staffOptions.filter(staff => service.staffIds.includes(staff.id));
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => openServiceFile(service)}
                className={`service-desk-row w-full text-left p-4 md:p-5 transition-colors bg-white text-black hover:bg-neutral-50 ${selectedId === service.id ? 'service-desk-row-active' : ''}`}
              >
                <div className="grid lg:grid-cols-[minmax(0,1.4fr),minmax(0,1fr),auto] gap-4 items-center">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-neutral-100 bg-neutral-50">
                      {service.imageUrls?.[0] ? (
                        <img src={service.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Briefcase size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-lg truncate">{service.name}</h3>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${service.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-100 text-neutral-500 border border-neutral-100'}`}>
                          {service.active !== false ? 'Live' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2 text-neutral-500">{service.description || 'No description yet.'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {service.category && <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] bg-neutral-100 text-neutral-500">{service.category}</span>}
                    {formatServiceDuration(service.duration) && <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] bg-neutral-100 text-neutral-500">{formatServiceDuration(service.duration)}</span>}
                    {formatServicePrice(service) && <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] bg-neutral-100 text-neutral-500">{formatServicePrice(service)}</span>}
                    {assignedStaff.length > 0 ? (
                      <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] bg-neutral-100 text-neutral-500">{assignedStaff.length} staff</span>
                    ) : (
                      <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] bg-amber-50 text-amber-700 border border-amber-100">No staff</span>
                    )}
                  </div>

                  <div className="justify-self-start lg:justify-self-end">
                    <span className="h-10 px-4 rounded-lg border border-neutral-200 bg-white text-black text-[10px] font-black uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2">
                      <Edit3 size={13} /> Open File
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {isServiceModalOpen && (
        <div className="service-modal fixed inset-0 z-[150] bg-black/45 backdrop-blur-sm p-3 md:p-6 flex items-end md:items-center justify-center">
          <div className="service-modal-panel w-full max-w-6xl max-h-[92vh] rounded-[1.75rem] bg-white border border-white/80 shadow-2xl shadow-black/25 overflow-hidden flex flex-col">
            <div className="p-4 md:p-5 border-b border-neutral-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400">Create Service</p>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black truncate">
                  {selectedServiceExists ? draft.name || 'Edit service' : 'Create service'}
                </h2>
                <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
                  Set the service clients can book, who can deliver it, and what details carry into bookings and the calendar.
                </p>
              </div>
              <button type="button" onClick={closeServiceModal} className="w-11 h-11 rounded-full border border-neutral-200 bg-white text-black inline-flex items-center justify-center shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="service-modal-body overflow-y-auto p-4 md:p-5 grid xl:grid-cols-[minmax(0,1.15fr),minmax(330px,0.85fr)] gap-5">
              <div className="space-y-4">
                <section className="rounded-2xl border border-neutral-200 p-4 md:p-5 bg-white">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Service Details</p>
                      <h3 className="text-xl font-black text-black mt-1">What clients book</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDraft('active', !draft.active)}
                      className={`h-10 px-4 rounded-full text-[10px] font-black uppercase tracking-[0.16em] ${draft.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}
                    >
                      {draft.active ? 'Live' : 'Hidden'}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="service-field sm:col-span-2">
                      <span>Name</span>
                      <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="Service name" />
                    </label>
                    <label className="service-field">
                      <span>Category</span>
                      <input value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} placeholder="Cut, class, consult..." />
                    </label>
                    <label className="service-field">
                      <span>Duration</span>
                      <input value={draft.duration} onChange={(event) => updateDraft('duration', event.target.value)} placeholder="60 or 1 hour" />
                    </label>
                    <label className="service-field sm:col-span-2">
                      <span>Description</span>
                      <textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} placeholder="What is included, who it is for, and anything clients should know." rows={4} />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 p-4 md:p-5 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Pricing</p>
                      <h3 className="text-xl font-black text-black mt-1">How this is charged</h3>
                    </div>
                    <DollarSign size={18} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {priceTypes.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => updateDraft('priceType', type.id)}
                        className={`h-10 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] ${draft.priceType === type.id ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-500 border border-neutral-100'}`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[78px,1fr] gap-3">
                    <label className="service-field">
                      <span>Currency</span>
                      <input value={draft.currency} onChange={(event) => updateDraft('currency', event.target.value)} />
                    </label>
                    <label className="service-field">
                      <span>Price</span>
                      <input value={draft.price} onChange={(event) => updateDraft('price', event.target.value)} placeholder={draft.priceType === 'quote' ? 'Optional' : '450'} />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 p-4 md:p-5 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Assigned Staff</p>
                      <h3 className="text-xl font-black text-black mt-1">Who can deliver it</h3>
                    </div>
                    <UserPlus size={18} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {staffOptions.map(staff => {
                      const active = draft.staffIds?.includes(staff.id);
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => toggleStaff(staff.id)}
                          className={`rounded-full border px-3 py-2 text-xs font-black inline-flex items-center gap-2 ${active ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-200'}`}
                        >
                          <span
                            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-black"
                            style={{ background: active ? '#ffffff22' : `${staff.color || '#755CFF'}22`, color: active ? '#fff' : staff.color || '#755CFF' }}
                          >
                            {getStaffInitial(staff)}
                          </span>
                          {staff.name || 'Staff'}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 p-4 md:p-5 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Gallery</p>
                      <h3 className="text-xl font-black text-black mt-1">Optional images</h3>
                    </div>
                    <Image size={18} />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                    {(draft.imageUrls || []).slice(0, 8).map((url, index) => (
                      <div key={`${url}-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeGalleryImage(index)} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black text-white inline-flex items-center justify-center">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-xl border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center cursor-pointer">
                      <Camera size={20} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={galleryInput}
                      onChange={(event) => setGalleryInput(event.target.value)}
                      placeholder="Paste image URL"
                      className="min-w-0 flex-1 h-11 rounded-xl bg-neutral-50 border border-neutral-200 px-3 text-sm font-bold outline-none"
                    />
                    <button type="button" onClick={addGalleryUrl} className="h-11 px-4 rounded-xl bg-neutral-900 text-white text-xs font-black uppercase tracking-[0.14em]">Add</button>
                  </div>
                </section>
              </div>

              <aside className="space-y-4 xl:sticky xl:top-0 self-start">
                <section className="rounded-2xl border border-neutral-200 p-4 md:p-5 bg-neutral-50">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Booking Preview</p>
                  <div className="rounded-2xl bg-white border border-neutral-100 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-black text-white inline-flex items-center justify-center shrink-0">
                        {draft.imageUrls?.[0] ? (
                          <img src={draft.imageUrls[0]} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <Briefcase size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-black">{draft.name || 'Service name'}</h3>
                        <p className="text-xs text-neutral-500 mt-1">{draft.description || 'Client-facing description will show here.'}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {draft.category && <span className="rounded-full bg-neutral-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">{draft.category}</span>}
                          {formatServiceDuration(draft.duration) && <span className="rounded-full bg-neutral-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500 inline-flex items-center gap-1"><Clock size={11} />{formatServiceDuration(draft.duration)}</span>}
                          {formatServicePrice(draft) && <span className="rounded-full bg-neutral-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">{formatServicePrice(draft)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 p-4 md:p-5 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Workflow</p>
                  <h3 className="text-xl font-black text-black mt-1">Where this service appears</h3>
                  <div className="grid gap-2 mt-4">
                    {['Booking page service step', 'Bookings desk service summary', 'Schedule booking record', 'Client profile history'].map(item => (
                      <div key={item} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm font-bold text-neutral-600 flex items-center gap-2">
                        <Check size={14} /> {item}
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>

            <div className="p-4 md:p-5 border-t border-neutral-100 bg-white flex flex-col sm:flex-row gap-3 sm:justify-between">
              <button
                type="button"
                onClick={removeDraft}
                disabled={!draft.id || !selectedServiceExists || !canManageWorkspace}
                className="h-12 px-5 rounded-full border border-red-100 bg-red-50 text-red-600 text-xs font-black uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Trash2 size={15} /> Remove
              </button>
              <div className="grid sm:grid-cols-2 gap-3 sm:min-w-[24rem]">
                <button
                  type="button"
                  onClick={closeServiceModal}
                  className="h-12 rounded-full border border-neutral-200 bg-white text-black text-xs font-black uppercase tracking-[0.16em]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={!canManageWorkspace}
                  className="h-12 rounded-full bg-black text-white text-xs font-black uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Check size={15} /> Save Service
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
