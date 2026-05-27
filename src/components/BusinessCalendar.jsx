import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock, Maximize2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react';
import { getLocalDateStr } from '../utils/dates';

// --- CALENDAR ENGINE (Business Settings) ---
        export const BusinessCalendar = ({
            settings,
            setSettings,
            onSave,
            showToast,
            bookings = [],
            clientDirectory = [],
            staffList = [],
            activeStaffId = 'owner',
            workspaceRole = 'owner',
            googleCalendarState = {},
            onConnectGoogleCalendar,
            onSyncGoogleCalendar
        }) => {
            const [currentMonth, setCurrentMonth] = useState(new Date());
            const [expandedDate, setExpandedDate] = useState(getLocalDateStr(new Date()));
            const [slotEditor, setSlotEditor] = useState(null);
            const [scheduleStatsPeriod, setScheduleStatsPeriod] = useState('month');
            const calendarViewMode = scheduleStatsPeriod;
            const initialCalendarId = workspaceRole === 'staff' ? (activeStaffId || 'owner') : 'workspace';
            const [selectedCalendarId, setSelectedCalendarId] = useState(initialCalendarId);
            const [overviewDayFocusStaffId, setOverviewDayFocusStaffId] = useState('workspace');
            const [hidePastDays, setHidePastDays] = useState(true);
            const [isMobilePortraitCalendar, setIsMobilePortraitCalendar] = useState(() => (
                typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px) and (orientation: portrait)')?.matches
            ));
            useEffect(() => {
                if (workspaceRole === 'staff' && activeStaffId) setSelectedCalendarId(activeStaffId);
            }, [activeStaffId, workspaceRole]);
            const getStaffDisplayName = (staff = {}) => staff.name || staff.displayName || staff.email?.split('@')[0] || 'Team member';
            const getStaffUsername = (staff = {}) => staff.username || staff.handle || (staff.email ? `@${staff.email.split('@')[0]}` : `${staff.role || 'staff'} calendar`);
            const getStaffInitials = (name = 'Team member') => name.split(' ').map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase();
            const normalizeEmailKey = (value = '') => String(value || '').trim().toLowerCase();
            const normalizePhoneKey = (value = '') => String(value || '').replace(/\D/g, '');
            const getBookingClientProfile = (booking = {}) => {
                const emailKey = normalizeEmailKey(booking.clientEmail || booking.email || '');
                const phoneKey = normalizePhoneKey(booking.clientPhone || booking.phone || '');
                const nameKey = String(booking.clientName || '').trim().toLowerCase();
                return clientDirectory.find(client => (
                    (emailKey && normalizeEmailKey(client.email || '') === emailKey) ||
                    (phoneKey && normalizePhoneKey(client.phone || '') === phoneKey) ||
                    (nameKey && String(client.name || '').trim().toLowerCase() === nameKey)
                )) || null;
            };
            const getBookingClientAvatar = (booking = {}) => (
                booking.clientPhotoURL ||
                booking.clientAvatar ||
                booking.avatar ||
                getBookingClientProfile(booking)?.avatar ||
                ''
            );
            const staffMembersForCoverage = useMemo(() => {
                const activeStaff = (staffList || []).filter(staff => staff?.id && staff.accessEnabled !== false);
                const fallbackStaff = [{ id: activeStaffId || 'owner', name: workspaceRole === 'staff' ? 'My Calendar' : 'Owner', role: workspaceRole === 'staff' ? 'staff' : 'owner', color: '#000000' }];
                return (activeStaff.length ? activeStaff : fallbackStaff)
                    .filter((staff, index, list) => staff?.id && list.findIndex(item => item.id === staff.id) === index);
            }, [activeStaffId, staffList, workspaceRole]);
            const staffCalendarOptions = useMemo(() => {
                return [
                    { id: 'workspace', name: 'Business Overview', role: `${staffMembersForCoverage.length} ${staffMembersForCoverage.length === 1 ? 'profile' : 'profiles'}`, color: '#000000', username: 'full business view', icon: 'business' },
                    ...staffMembersForCoverage.map(staff => ({
                        id: staff.id,
                        name: getStaffDisplayName(staff),
                        role: staff.role === 'owner' ? 'Owner' : staff.role === 'admin' ? 'Admin' : 'Staff',
                        username: getStaffUsername(staff),
                        color: staff.color || '#39FF14',
                        photoURL: staff.photoURL || ''
                    }))
                ].filter((calendar, index, list) => calendar.id && list.findIndex(item => item.id === calendar.id) === index);
            }, [staffMembersForCoverage]);
            const selectedCalendar = staffCalendarOptions.find(calendar => calendar.id === selectedCalendarId) || staffCalendarOptions[0];
            const visibleCalendarOptions = staffCalendarOptions;
            const isWorkspaceCalendar = selectedCalendarId === 'workspace';
            const isAggregateCalendar = selectedCalendarId === 'all-staff';
            const isSingleStaffCalendar = !isWorkspaceCalendar && !isAggregateCalendar;
            const activeStaffCalendar = isSingleStaffCalendar ? (settings.staffCalendars?.[selectedCalendarId] || {}) : null;
            const activeSchedule = isSingleStaffCalendar ? (activeStaffCalendar?.schedule || {}) : (settings.schedule || {});
            const canEditSelectedCalendar = !isAggregateCalendar && (workspaceRole !== 'staff' || selectedCalendarId === activeStaffId);
            const readOnlyCalendarMessage = isWorkspaceCalendar
                ? 'Business overview is view only for staff. Switch to your own calendar to edit availability.'
                : 'You can view teammate calendars, but only edit your own availability.';
            useEffect(() => {
                if (!staffCalendarOptions.some(calendar => calendar.id === selectedCalendarId)) {
                    setSelectedCalendarId(workspaceRole === 'staff' ? (activeStaffId || 'workspace') : 'workspace');
                }
            }, [activeStaffId, selectedCalendarId, staffCalendarOptions, workspaceRole]);
            useEffect(() => {
                if (!isWorkspaceCalendar && overviewDayFocusStaffId !== 'workspace') {
                    setOverviewDayFocusStaffId('workspace');
                }
            }, [isWorkspaceCalendar, overviewDayFocusStaffId]);
            const businessDefaultTimes = Array.isArray(settings.availableTimes) ? settings.availableTimes : [];
            const getCalendarDefaultTimes = (calendarId) => {
                if (calendarId === 'workspace') return businessDefaultTimes;
                const staffCalendar = settings.staffCalendars?.[calendarId] || {};
                return Array.isArray(staffCalendar.availableTimes) ? staffCalendar.availableTimes : businessDefaultTimes;
            };
            const getCalendarDayConfig = (calendarId, dateStr) => {
                const schedule = calendarId === 'workspace'
                    ? (settings.schedule || {})
                    : (settings.staffCalendars?.[calendarId]?.schedule || {});
                const savedConfig = schedule?.[dateStr];
                return {
                    available: savedConfig?.available ?? true,
                    times: Array.isArray(savedConfig?.times) ? savedConfig.times : [...getCalendarDefaultTimes(calendarId)]
                };
            };
            const defaultTimes = isAggregateCalendar
                ? [...new Set(staffMembersForCoverage.flatMap(staff => getCalendarDefaultTimes(staff.id)))].sort()
                : getCalendarDefaultTimes(selectedCalendarId);
            const todayStr = getLocalDateStr(new Date());
            const monthLookup = {
                jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
                may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
                sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
            };
            const dateFromKey = (dateStr) => new Date(`${dateStr}T00:00:00`);
            const addDaysToDate = (date, days) => {
                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() + days);
                return nextDate;
            };
            const getDateRange = (startDate, endDate) => {
                const dates = [];
                const cursor = new Date(startDate);
                while (cursor <= endDate) {
                    dates.push(getLocalDateStr(cursor));
                    cursor.setDate(cursor.getDate() + 1);
                }
                return dates;
            };
            const formatCompactDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const daysInMonth = useMemo(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days = [];
                for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
                for (let i = 1; i <= daysInMonth; i++) days.push(getLocalDateStr(new Date(year, month, i)));
                return days;
            }, [currentMonth]);

            const getDayConfig = (dateStr) => {
                if (isAggregateCalendar) {
                    const businessConfig = getCalendarDayConfig('workspace', dateStr);
                    if (!businessConfig.available) return { available: false, times: [] };
                    if (!staffMembersForCoverage.length) return businessConfig;
                    const businessTimes = new Set(businessConfig.times || []);
                    const coveredTimes = staffMembersForCoverage
                        .flatMap(staff => {
                            const staffConfig = getCalendarDayConfig(staff.id, dateStr);
                            if (!staffConfig.available) return [];
                            return (staffConfig.times || []).filter(time => !businessTimes.size || businessTimes.has(time));
                        });
                    const uniqueTimes = [...new Set(coveredTimes)].sort();
                    return {
                        available: uniqueTimes.length > 0,
                        times: uniqueTimes
                    };
                }

                return getCalendarDayConfig(selectedCalendarId, dateStr);
            };

            const getBookingDateKey = (booking) => {
                if (booking.dateKey) return booking.dateKey;
                const rawDate = String(booking.date || '').trim();
                if (!rawDate) return null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
                if (/^today$/i.test(rawDate)) return todayStr;
                if (/^tomorrow$/i.test(rawDate)) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return getLocalDateStr(tomorrow);
                }

                const dayMonthMatch = rawDate.match(/(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*,?\s*(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
                if (dayMonthMatch) {
                    const day = Number(dayMonthMatch[1]);
                    const month = monthLookup[dayMonthMatch[2].toLowerCase()];
                    const year = Number(dayMonthMatch[3]) || currentMonth.getFullYear();
                    if (!Number.isNaN(day) && month !== undefined) return getLocalDateStr(new Date(year, month, day));
                }

                const parsed = new Date(rawDate);
                return Number.isNaN(parsed.getTime()) ? null : getLocalDateStr(parsed);
            };

            const bookingsByDate = useMemo(() => {
                return (bookings || []).reduce((summary, booking) => {
                    const dateKey = getBookingDateKey(booking);
                    if (!dateKey || booking.status === 'declined') return summary;
                    if (isSingleStaffCalendar && booking.staffId !== selectedCalendarId) return summary;
                    if (!summary[dateKey]) summary[dateKey] = { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
                    summary[dateKey].total += 1;
                    if (booking.status === 'confirmed') summary[dateKey].confirmed += 1;
                    if (booking.status === 'pending') summary[dateKey].pending += 1;
                    if (booking.status === 'waitlist' || booking.time === 'Waitlist') summary[dateKey].waitlist += 1;
                    if (booking.status !== 'waitlist' && booking.time !== 'Waitlist') summary[dateKey].reserved += 1;
                    return summary;
                }, {});
            }, [bookings, todayStr, currentMonth, selectedCalendarId, isSingleStaffCalendar]);

            const getCalendarBubble = (dateStr, config) => {
                const dayBookings = bookingsByDate[dateStr] || { confirmed: 0, reserved: 0 };
                const isPastDay = dateStr < todayStr;
                const openSlots = Math.max(0, (config.times?.length || 0) - dayBookings.reserved);

                if (isPastDay || dayBookings.confirmed > 0) {
                    return {
                        label: `${dayBookings.confirmed} ${dayBookings.confirmed === 1 ? 'booking' : 'bookings'} confirmed`,
                        count: dayBookings.confirmed,
                        caption: 'confirmed',
                        tone: dayBookings.confirmed > 0 ? 'confirmed' : 'quiet'
                    };
                }

                if (!config.available) return { label: 'Closed', count: null, caption: 'Closed', tone: 'closed' };

                return {
                    label: `${openSlots} ${openSlots === 1 ? 'slot' : 'slots'} open`,
                    count: openSlots,
                    caption: openSlots > 0 ? 'open' : 'full',
                    tone: openSlots > 0 ? 'open' : 'full'
                };
            };

            const guardCalendarEdit = (calendarId = selectedCalendarId) => {
                if (calendarId === 'all-staff') {
                    showToast("Choose Business Overview or a staff member to edit availability.");
                    return false;
                }
                const canEditTargetCalendar = workspaceRole !== 'staff' || calendarId === activeStaffId;
                if (!canEditTargetCalendar) {
                    showToast(readOnlyCalendarMessage);
                    return false;
                }
                return true;
            };

            const getStaffCoverageForDate = (dateStr) => {
                if (!dateStr || !staffMembersForCoverage.length) return [];
                const businessConfig = getCalendarDayConfig('workspace', dateStr);
                if (!businessConfig.available) return [];
                const businessTimes = new Set(businessConfig.times || []);
                return staffMembersForCoverage.filter(staff => {
                    const staffConfig = getCalendarDayConfig(staff.id, dateStr);
                    if (!staffConfig.available) return false;
                    return (staffConfig.times || []).some(time => !businessTimes.size || businessTimes.has(time));
                });
            };

            const updateDateConfigForCalendar = (calendarId, dateStr, nextConfig) => {
                if (!guardCalendarEdit(calendarId)) return false;
                setSettings(prev => {
                    if (calendarId === 'workspace') {
                        return {
                            ...prev,
                            schedule: {
                                ...(prev.schedule || {}),
                                [dateStr]: nextConfig
                            }
                        };
                    }
                    const previousCalendar = prev.staffCalendars?.[calendarId] || {};
                    return {
                        ...prev,
                        staffCalendars: {
                            ...(prev.staffCalendars || {}),
                            [calendarId]: {
                                ...previousCalendar,
                                staffId: calendarId,
                                schedule: {
                                    ...(previousCalendar.schedule || {}),
                                    [dateStr]: nextConfig
                                },
                                updatedAt: Date.now()
                            }
                        }
                    };
                });
                return true;
            };

            const updateDateConfig = (dateStr, nextConfig) => {
                updateDateConfigForCalendar(selectedCalendarId, dateStr, nextConfig);
            };

            const toggleDateAvailability = (dateStr) => {
                const config = getDayConfig(dateStr);
                updateDateConfig(dateStr, {
                    ...config,
                    available: !config.available
                });
            };

            const getNextOpenTime = (existingTimes = []) => {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const nextHalfHour = Math.ceil((currentMinutes + 1) / 30) * 30;
                for (let i = 0; i < 48; i++) {
                    const minutes = (nextHalfHour + i * 30) % (24 * 60);
                    const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
                    const minute = String(minutes % 60).padStart(2, '0');
                    const candidate = `${hour}:${minute}`;
                    if (!existingTimes.includes(candidate)) return candidate;
                }
                return '18:00';
            };

            const getSlotStartMinutes = (slot = '') => {
                const match = String(slot).match(/(\d{1,2}):(\d{2})/);
                if (!match) return 9999;
                return (Number(match[1]) * 60) + Number(match[2]);
            };

            const parseSlotValue = (slot = '') => {
                const raw = String(slot || '').trim();
                const rangeMatch = raw.match(/^(.+?)\s*(?:-|\bto\b)\s*(.+)$/i);
                if (rangeMatch) {
                    return {
                        mode: 'range',
                        start: rangeMatch[1].trim(),
                        end: rangeMatch[2].trim()
                    };
                }
                return { mode: 'single', start: raw, end: '' };
            };

            const formatSlotEditorValue = (editor = {}) => {
                const start = String(editor.start || '').trim();
                const end = String(editor.end || '').trim();
                if (editor.mode === 'range' && end) return `${start} - ${end}`;
                return start;
            };

            const toTimeParts = (value = '', fallback = '09:00') => {
                const source = String(value || fallback || '09:00');
                const match = source.match(/^(\d{1,2}):(\d{2})/);
                const rawHour = match ? Number(match[1]) : 9;
                const rawMinute = match ? Number(match[2]) : 0;
                return {
                    hour: Math.min(23, Math.max(0, Number.isFinite(rawHour) ? rawHour : 9)),
                    minute: Math.min(59, Math.max(0, Number.isFinite(rawMinute) ? rawMinute : 0))
                };
            };

            const timePartsToValue = ({ hour = 9, minute = 0 } = {}) => (
                `${String(Math.min(23, Math.max(0, hour))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, minute))).padStart(2, '0')}`
            );

            const timeValueToMinutes = (value = '', fallback = '09:00') => {
                const { hour, minute } = toTimeParts(value, fallback);
                return (hour * 60) + minute;
            };

            const minutesToTimeValue = (minutes = 0) => {
                const normalized = ((minutes % 1440) + 1440) % 1440;
                return timePartsToValue({
                    hour: Math.floor(normalized / 60),
                    minute: normalized % 60
                });
            };

            const addMinutesToTime = (value = '', delta = 0, fallback = '09:00') => (
                minutesToTimeValue(timeValueToMinutes(value, fallback) + delta)
            );

            const sortSlotValues = (times = []) => [...new Set(times.map(time => String(time || '').trim()).filter(Boolean))]
                .sort((a, b) => getSlotStartMinutes(a) - getSlotStartMinutes(b) || a.localeCompare(b));

            const startAddingSlot = ({ dateStr = expandedDate, calendarId = selectedCalendarId, times = [] } = {}) => {
                if (!dateStr || !guardCalendarEdit(calendarId)) return;
                setSlotEditor({
                    originalTime: null,
                    dateStr,
                    calendarId,
                    mode: 'single',
                    start: getNextOpenTime(times),
                    end: ''
                });
            };

            const startEditingDaySlot = ({ time, dateStr = expandedDate, calendarId = selectedCalendarId } = {}) => {
                if (!time || !dateStr || !guardCalendarEdit(calendarId)) return;
                const parsed = parseSlotValue(time);
                setSlotEditor({
                    originalTime: time,
                    dateStr,
                    calendarId,
                    ...parsed
                });
            };

            const saveSlotEditor = () => {
                if (!slotEditor?.dateStr || !slotEditor?.calendarId || !guardCalendarEdit(slotEditor.calendarId)) return;
                const slotValue = formatSlotEditorValue(slotEditor);
                if (!slotValue) {
                    showToast("Add a time before saving this slot.");
                    return;
                }
                if (slotEditor.mode === 'range') {
                    if (!slotEditor.end) {
                        showToast("Add an end time for this slot period.");
                        return;
                    }
                    if (timeValueToMinutes(slotEditor.end) <= timeValueToMinutes(slotEditor.start)) {
                        showToast("End time must be later than the start time.");
                        return;
                    }
                }
                const targetConfig = getCalendarDayConfig(slotEditor.calendarId, slotEditor.dateStr);
                if (targetConfig.times.includes(slotValue) && slotValue !== slotEditor.originalTime) {
                    showToast("That time already exists for this day.");
                    return;
                }
                const nextTimes = slotEditor.originalTime
                    ? targetConfig.times.map(time => time === slotEditor.originalTime ? slotValue : time)
                    : [...targetConfig.times, slotValue];
                updateDateConfigForCalendar(slotEditor.calendarId, slotEditor.dateStr, {
                    ...targetConfig,
                    available: true,
                    times: sortSlotValues(nextTimes)
                });
                setSlotEditor(null);
            };

            const deleteSlotFromEditor = () => {
                if (!slotEditor?.dateStr || !slotEditor?.calendarId || !guardCalendarEdit(slotEditor.calendarId)) return;
                if (!slotEditor.originalTime) {
                    setSlotEditor(null);
                    return;
                }
                const targetConfig = getCalendarDayConfig(slotEditor.calendarId, slotEditor.dateStr);
                updateDateConfigForCalendar(slotEditor.calendarId, slotEditor.dateStr, {
                    ...targetConfig,
                    times: targetConfig.times.filter(time => time !== slotEditor.originalTime)
                });
                setSlotEditor(null);
            };

            const selectedConfig = expandedDate ? getDayConfig(expandedDate) : null;
            const selectedDateLabel = expandedDate
                ? new Date(`${expandedDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : 'Select a date';
            const selectedAgendaDate = calendarViewMode === 'day' && hidePastDays && expandedDate < todayStr ? todayStr : expandedDate;
            const selectedAgendaStaffCoverage = isWorkspaceCalendar && selectedAgendaDate
                ? getStaffCoverageForDate(selectedAgendaDate)
                : [];
            const activeOverviewDayFocusId = isWorkspaceCalendar && selectedAgendaStaffCoverage.some(staff => staff.id === overviewDayFocusStaffId)
                ? overviewDayFocusStaffId
                : 'workspace';
            const selectedAgendaCalendarId = isWorkspaceCalendar && activeOverviewDayFocusId !== 'workspace'
                ? activeOverviewDayFocusId
                : selectedCalendarId;
            const selectedDayBookingList = useMemo(() => {
                const toMinutes = (time = '') => {
                    const match = String(time).match(/^(\d{1,2}):(\d{2})/);
                    if (!match) return 9999;
                    return (Number(match[1]) * 60) + Number(match[2]);
                };

                return (bookings || [])
                    .map(booking => ({ ...booking, dateKeyResolved: getBookingDateKey(booking) }))
                    .filter(booking => (
                        booking.dateKeyResolved === selectedAgendaDate &&
                        booking.status !== 'declined' &&
                        (selectedAgendaCalendarId === 'workspace' || booking.staffId === selectedAgendaCalendarId)
                    ))
                    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time) || String(a.clientName || '').localeCompare(String(b.clientName || '')));
            }, [bookings, selectedAgendaDate, selectedAgendaCalendarId, todayStr, currentMonth]);
            const selectedDayBookingsByTime = useMemo(() => {
                return selectedDayBookingList.reduce((groups, booking) => {
                    const timeKey = booking.time || 'Unscheduled';
                    groups[timeKey] = [...(groups[timeKey] || []), booking];
                    return groups;
                }, {});
            }, [selectedDayBookingList]);
            const getBookingStatusMeta = (booking) => {
                if (booking?.status === 'confirmed') return { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
                if (booking?.status === 'waitlist' || booking?.time === 'Waitlist') return { label: 'Waitlist', className: 'bg-violet-50 text-violet-700 border-violet-100' };
                if (booking?.status === 'pending') return { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-100' };
                return { label: booking?.status || 'Request', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
            };
            const calendarAnchorDate = expandedDate ? dateFromKey(expandedDate) : new Date();
            const calendarWeekStart = addDaysToDate(calendarAnchorDate, -((calendarAnchorDate.getDay() + 6) % 7));
            const calendarWeekEnd = addDaysToDate(calendarWeekStart, 6);
            const calendarWindowLabel = calendarViewMode === 'month'
                ? currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : calendarViewMode === 'week'
                    ? `${formatCompactDate(calendarWeekStart)} - ${formatCompactDate(calendarWeekEnd)}`
                    : selectedDateLabel;
            const calendarTitle = calendarViewMode === 'month' ? 'Monthly Calendar' : calendarViewMode === 'week' ? 'Week Schedule' : 'Day Schedule';
            const calendarDescription = calendarViewMode === 'month'
                ? 'Open, close, and tune each day from one calm workspace.'
                : calendarViewMode === 'week'
                    ? 'Manage the current week without carrying the whole month around.'
                    : 'Focus on one day, its slots, and its booking capacity.';
            const calendarHeaderLabels = calendarViewMode === 'day'
                ? [calendarAnchorDate.toLocaleDateString('en-US', { weekday: 'short' })]
                : calendarViewMode === 'week'
                    ? getDateRange(calendarWeekStart, calendarWeekEnd)
                        .filter(dateStr => !hidePastDays || dateStr >= todayStr)
                        .map(dateStr => dateFromKey(dateStr).toLocaleDateString('en-US', { weekday: 'short' }))
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const calendarDisplayDays = useMemo(() => {
                if (calendarViewMode === 'day') {
                    const dayKey = hidePastDays && expandedDate < todayStr ? todayStr : expandedDate;
                    return [dayKey || todayStr];
                }

                if (calendarViewMode === 'week') {
                    const visibleWeek = getDateRange(calendarWeekStart, calendarWeekEnd).filter(dateStr => !hidePastDays || dateStr >= todayStr);
                    return visibleWeek.length ? visibleWeek : [todayStr];
                }

                if (hidePastDays) {
                    const visibleMonthDays = daysInMonth.filter(dateStr => dateStr && dateStr >= todayStr);
                    return visibleMonthDays.length ? visibleMonthDays : [todayStr];
                }

                return daysInMonth.map(dateStr => {
                    if (!dateStr) return null;
                    return dateStr;
                });
            }, [calendarViewMode, expandedDate, hidePastDays, todayStr, daysInMonth, calendarWeekStart, calendarWeekEnd]);
            const calendarGridClass = calendarViewMode === 'day'
                ? 'grid-cols-1'
                : 'grid-cols-2 md:grid-cols-7';
            const calendarHeaderClass = calendarViewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7';
            const calendarHeaderVisibilityClass = calendarViewMode === 'day' ? 'hidden' : 'hidden md:grid';
            const calendarFrameClass = 'min-w-0';
            const calendarCellSizeClass = calendarViewMode === 'day'
                ? 'min-h-[420px] md:min-h-[460px]'
                : calendarViewMode === 'week'
                    ? 'min-h-[172px] md:min-h-[220px]'
                    : 'min-h-[148px] md:min-h-[174px]';

            const setSchedulePeriod = (period) => {
                setScheduleStatsPeriod(period);
                if (period === 'month' && isMobilePortraitCalendar) {
                    setHidePastDays(true);
                }
                if (period !== 'month' && hidePastDays && expandedDate < todayStr) {
                    const today = new Date();
                    setExpandedDate(todayStr);
                    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                }
            };

            const toggleHidePastDays = () => {
                const nextValue = !hidePastDays;
                setHidePastDays(nextValue);
                if (nextValue && expandedDate < todayStr) {
                    const today = new Date();
                    setExpandedDate(todayStr);
                    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                }
            };

            const moveCalendarWindow = (direction) => {
                if (calendarViewMode === 'month') {
                    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
                    if (hidePastDays && new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0) < dateFromKey(todayStr)) return;
                    setCurrentMonth(nextMonth);
                    return;
                }

                const nextDate = addDaysToDate(calendarAnchorDate, direction * (calendarViewMode === 'week' ? 7 : 1));
                const nextDateKey = getLocalDateStr(nextDate);
                if (hidePastDays && nextDateKey < todayStr) return;
                setExpandedDate(nextDateKey);
                setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
            };

            const scheduleInsight = useMemo(() => {
                const anchorDate = expandedDate ? dateFromKey(expandedDate) : new Date();
                const weekStart = addDaysToDate(anchorDate, -((anchorDate.getDay() + 6) % 7));
                const weekEnd = addDaysToDate(weekStart, 6);
                const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                const periodDates = scheduleStatsPeriod === 'day'
                    ? [getLocalDateStr(anchorDate)]
                    : scheduleStatsPeriod === 'week'
                        ? getDateRange(weekStart, weekEnd)
                        : getDateRange(monthStart, monthEnd);
                const label = scheduleStatsPeriod === 'day'
                    ? selectedDateLabel
                    : scheduleStatsPeriod === 'week'
                        ? `${formatCompactDate(weekStart)} - ${formatCompactDate(weekEnd)}`
                        : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                const summary = periodDates.reduce((acc, dateStr) => {
                    const config = getDayConfig(dateStr);
                    const savedConfig = activeSchedule?.[dateStr];
                    const dayBookings = bookingsByDate[dateStr] || { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
                    const capacity = config.available ? (config.times?.length || 0) : 0;
                    const openSlots = dateStr >= todayStr && config.available ? Math.max(0, capacity - dayBookings.reserved) : 0;

                    acc.totalDays += 1;
                    acc.confirmed += dayBookings.confirmed;
                    acc.pending += dayBookings.pending;
                    acc.waitlist += dayBookings.waitlist;
                    acc.reserved += dayBookings.reserved;
                    acc.capacity += capacity;
                    acc.openSlots += openSlots;
                    if (config.available) acc.openDays += 1;
                    else acc.closedDays += 1;
                    if (savedConfig) acc.customDays += 1;
                    return acc;
                }, { totalDays: 0, openDays: 0, closedDays: 0, customDays: 0, capacity: 0, openSlots: 0, confirmed: 0, pending: 0, waitlist: 0, reserved: 0 });

                const fillRate = summary.capacity ? Math.min(100, Math.round((summary.reserved / summary.capacity) * 100)) : 0;
                const dayStatus = !selectedConfig ? 'Select a date' : expandedDate < todayStr ? 'Past Day' : selectedConfig.available ? 'Open' : 'Closed';

                return {
                    ...summary,
                    label,
                    fillRate,
                    dayStatus,
                    periodName: scheduleStatsPeriod.charAt(0).toUpperCase() + scheduleStatsPeriod.slice(1)
                };
            }, [scheduleStatsPeriod, expandedDate, selectedDateLabel, selectedConfig, currentMonth, activeSchedule, defaultTimes, bookingsByDate, todayStr]);

            const scheduleMetricCards = useMemo(() => {
                return [
                    {
                        label: 'Bookings Confirmed',
                        value: scheduleInsight.confirmed,
                        hint: scheduleStatsPeriod === 'day' ? scheduleInsight.label : scheduleInsight.periodName,
                        icon: CalendarCheck,
                        tone: 'accent'
                    },
                    {
                        label: 'Total Available Slots',
                        value: scheduleInsight.openSlots,
                        hint: `${scheduleInsight.capacity} total capacity`,
                        icon: Clock,
                        tone: 'light'
                    }
                ];
            }, [scheduleStatsPeriod, scheduleInsight]);

            useEffect(() => {
                setSlotEditor(null);
            }, [expandedDate, selectedCalendarId, overviewDayFocusStaffId]);

            useEffect(() => {
                if (typeof window === 'undefined' || !window.matchMedia) return undefined;
                const portraitQuery = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
                const updatePortraitState = () => setIsMobilePortraitCalendar(portraitQuery.matches);
                updatePortraitState();
                if (portraitQuery.addEventListener) {
                    portraitQuery.addEventListener('change', updatePortraitState);
                    return () => portraitQuery.removeEventListener('change', updatePortraitState);
                }
                portraitQuery.addListener?.(updatePortraitState);
                return () => portraitQuery.removeListener?.(updatePortraitState);
            }, []);

            useEffect(() => {
                if (calendarViewMode === 'month' && isMobilePortraitCalendar) {
                    setHidePastDays(true);
                }
            }, [calendarViewMode, isMobilePortraitCalendar]);

            const googleSyncableBookings = useMemo(() => (
                (bookings || []).filter(booking => (
                    !booking.isExample &&
                    booking.status === 'confirmed' &&
                    booking.dateKey &&
                    booking.time &&
                    booking.time !== 'Waitlist' &&
                    !booking.googleCalendarEventId &&
                    (!isSingleStaffCalendar || booking.staffId === selectedCalendarId)
                ))
            ), [bookings, isSingleStaffCalendar, selectedCalendarId]);
            const googleCalendarConnected = Boolean(googleCalendarState.connected);
            const googleCalendarLabel = googleCalendarConnected
                ? 'Google Connected'
                : googleCalendarState.email
                    ? 'Reconnect Google'
                    : 'Connect Google';

            const renderSlotEditor = () => {
                if (!slotEditor) return null;
                const isRangeMode = slotEditor.mode === 'range';
                const updateEditor = (nextFields) => setSlotEditor(current => current ? { ...current, ...nextFields } : current);
                const targetDateLabel = slotEditor.dateStr
                    ? new Date(`${slotEditor.dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'Selected day';
                const previewValue = isRangeMode
                    ? `${slotEditor.start || 'Start'} - ${slotEditor.end || 'End'}`
                    : (formatSlotEditorValue(slotEditor) || 'Choose a time');
                const quickTimes = ['08:00', '09:00', '10:30', '12:00', '14:30', '16:00'];
                const minuteOptions = [0, 15, 30, 45];
                const durationOptions = [
                    { label: '30m', minutes: 30 },
                    { label: '1h', minutes: 60 },
                    { label: '90m', minutes: 90 },
                    { label: '2h', minutes: 120 }
                ];
                const setTimeField = (field, value) => updateEditor({ [field]: value });
                const nudgeTimeField = (field, delta) => {
                    const fallback = field === 'end' ? addMinutesToTime(slotEditor.start, 60) : '09:00';
                    setTimeField(field, addMinutesToTime(slotEditor[field], delta, fallback));
                };
                const setTimePart = (field, part, rawValue) => {
                    const fallback = field === 'end' ? addMinutesToTime(slotEditor.start, 60) : '09:00';
                    const parts = toTimeParts(slotEditor[field], fallback);
                    const nextNumber = Number.parseInt(String(rawValue).replace(/\D/g, ''), 10);
                    if (!Number.isFinite(nextNumber)) return;
                    setTimeField(field, timePartsToValue({
                        ...parts,
                        [part]: part === 'hour'
                            ? Math.min(23, Math.max(0, nextNumber))
                            : Math.min(59, Math.max(0, nextNumber))
                    }));
                };
                const setDurationFromStart = (minutes) => updateEditor({
                    mode: 'range',
                    end: addMinutesToTime(slotEditor.start, minutes)
                });
                const renderTimeControl = (field, label) => {
                    const fallback = field === 'end' ? addMinutesToTime(slotEditor.start, 60) : '09:00';
                    const value = slotEditor[field] || fallback;
                    const { hour, minute } = toTimeParts(value, fallback);
                    const paddedHour = String(hour).padStart(2, '0');
                    const paddedMinute = String(minute).padStart(2, '0');

                    return (
                        <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">{label}</p>
                                    <p className="text-2xl sm:text-3xl font-black tracking-tight text-black mt-1">{value}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => nudgeTimeField(field, -15)} className="w-8 h-8 rounded-lg border border-neutral-200 bg-neutral-50 text-sm font-black text-black hover:border-black transition-colors" aria-label={`Move ${label} back 15 minutes`}>-</button>
                                    <button type="button" onClick={() => nudgeTimeField(field, 15)} className="w-8 h-8 rounded-lg border border-neutral-200 bg-neutral-50 text-sm font-black text-black hover:border-black transition-colors" aria-label={`Move ${label} forward 15 minutes`}>+</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                                <label className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 focus-within:border-black focus-within:bg-white transition-all">
                                    <span className="block text-[8px] font-bold uppercase tracking-[0.22em] text-neutral-400 mb-1">Hour</span>
                                    <input
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={2}
                                        value={paddedHour}
                                        onChange={(event) => setTimePart(field, 'hour', event.target.value)}
                                        className="w-full bg-transparent outline-none text-2xl font-black tracking-tight text-black text-center"
                                        aria-label={`${label} hour`}
                                    />
                                </label>
                                <span className="pb-3 text-2xl font-black text-neutral-300">:</span>
                                <label className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 focus-within:border-black focus-within:bg-white transition-all">
                                    <span className="block text-[8px] font-bold uppercase tracking-[0.22em] text-neutral-400 mb-1">Min</span>
                                    <input
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={2}
                                        value={paddedMinute}
                                        onChange={(event) => setTimePart(field, 'minute', event.target.value)}
                                        className="w-full bg-transparent outline-none text-2xl font-black tracking-tight text-black text-center"
                                        aria-label={`${label} minute`}
                                    />
                                </label>
                            </div>

                            <div className="mt-3 grid grid-cols-4 gap-2">
                                {minuteOptions.map(option => {
                                    const optionValue = timePartsToValue({ hour, minute: option });
                                    const isSelected = minute === option;
                                    return (
                                        <button
                                            type="button"
                                            key={`${field}-${option}`}
                                            onClick={() => setTimeField(field, optionValue)}
                                            className={`h-9 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white text-neutral-500 border-neutral-200 hover:border-black hover:text-black'}`}
                                        >
                                            {String(option).padStart(2, '0')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                };

                return (
                    <div className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200">
                        <div className="schedule-slot-modal relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[1.75rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl shadow-black/30">
                            <div className="h-1 native-gradient-line" />
                            <div className="p-5 sm:p-7">
                                <div className="flex items-start justify-between gap-4 mb-6">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-2">{slotEditor.originalTime ? 'Edit Slot' : 'New Slot'}</p>
                                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-black">Slot time</h2>
                                        <p className="text-sm sm:text-base font-medium text-neutral-500 mt-2 max-w-xl">Choose a simple listed time, or switch to a period for longer sessions, classes, or hourly services.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSlotEditor(null)}
                                        className="w-11 h-11 rounded-full border border-neutral-200 bg-white text-neutral-500 flex items-center justify-center hover:border-black hover:text-black transition-colors shrink-0"
                                        aria-label="Close slot editor"
                                    >
                                        <X size={18}/>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-4 sm:gap-5">
                                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 sm:p-4">
                                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 border border-neutral-100 mb-4">
                                            <button
                                                type="button"
                                                onClick={() => updateEditor({ mode: 'single', end: '' })}
                                                className={`h-12 rounded-lg px-4 text-[10px] font-bold uppercase tracking-widest transition-all ${!isRangeMode ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-neutral-500 hover:text-black hover:bg-neutral-50'}`}
                                            >
                                                Set time
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateEditor({ mode: 'range', end: slotEditor.end || addMinutesToTime(slotEditor.start, 60) })}
                                                className={`h-12 rounded-lg px-4 text-[10px] font-bold uppercase tracking-widest transition-all ${isRangeMode ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-neutral-500 hover:text-black hover:bg-neutral-50'}`}
                                            >
                                                Period
                                            </button>
                                        </div>

                                        {isRangeMode && (
                                            <div className="mb-4 rounded-xl border border-neutral-100 bg-white p-3">
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">Duration</p>
                                                    <p className="text-[10px] font-bold text-neutral-400">Starts at {slotEditor.start}</p>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {durationOptions.map(option => (
                                                        <button
                                                            type="button"
                                                            key={option.label}
                                                            onClick={() => setDurationFromStart(option.minutes)}
                                                            className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:border-black hover:bg-white hover:text-black transition-all"
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3">
                                            {renderTimeControl('start', isRangeMode ? 'Starts' : 'Time')}
                                            {isRangeMode && renderTimeControl('end', 'Ends')}
                                        </div>

                                        {!isRangeMode && (
                                            <div className="mt-4 rounded-xl border border-neutral-100 bg-white p-3">
                                                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400 mb-2">Quick picks</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {quickTimes.map(time => (
                                                        <button
                                                            type="button"
                                                            key={time}
                                                            onClick={() => setTimeField('start', time)}
                                                            className={`h-10 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${slotEditor.start === time ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-black hover:bg-white hover:text-black'}`}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 flex flex-col justify-between gap-5">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-2">Preview</p>
                                            <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-10 h-10 rounded-lg bg-white border border-neutral-100 flex items-center justify-center text-neutral-400">
                                                        <Clock size={16}/>
                                                    </span>
                                                    <div>
                                                        <p className="text-2xl font-black tracking-tight text-black">{previewValue}</p>
                                                        <p className="text-xs font-semibold text-neutral-400">{targetDateLabel}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs font-medium text-neutral-500 mt-3">
                                                {isRangeMode ? 'Clients see this as one bookable time period.' : 'Clients see this as one exact start time.'}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={deleteSlotFromEditor}
                                            className="h-11 rounded-xl border border-red-100 bg-red-50 px-4 text-[10px] font-bold uppercase tracking-widest text-red-600 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            disabled={!slotEditor.originalTime}
                                        >
                                            <Trash2 size={14}/> Delete slot
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSlotEditor(null)}
                                        className="h-12 rounded-xl border border-neutral-200 px-5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:border-black hover:text-black transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveSlotEditor}
                                        className="h-12 rounded-xl bg-black px-5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10"
                                    >
                                        Save slot
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            };

            return (
                <div className="w-full max-w-7xl mx-auto pb-32 animate-in fade-in duration-700">
                    <div className="mb-4 md:mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-3">
                        <div className="rounded-lg border border-neutral-100 bg-white px-4 py-3 shadow-sm flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-neutral-400">Google Calendar</p>
                                <p className="text-sm font-bold text-black truncate">
                                    {googleCalendarConnected ? `Connected${googleCalendarState.email ? ` as ${googleCalendarState.email}` : ''}` : 'Connect once, then sync confirmed bookings.'}
                                </p>
                            </div>
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${googleCalendarConnected ? 'bg-[#39FF14] shadow-[0_0_0_5px_rgba(57,255,20,0.15)]' : 'bg-neutral-200'}`} />
                        </div>
                        <button onClick={() => onConnectGoogleCalendar?.()} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-white border border-neutral-200 text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors shadow-sm text-black flex items-center justify-center gap-2">
                            <CalendarCheck size={15} /> {googleCalendarLabel}
                        </button>
                        <button onClick={() => onSyncGoogleCalendar?.(selectedCalendarId)} disabled={googleCalendarState.syncing} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-white border border-neutral-200 text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors shadow-sm text-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait">
                            <RefreshCw size={15} className={googleCalendarState.syncing ? 'animate-spin' : ''} /> {googleCalendarState.syncing ? 'Syncing' : `Sync ${googleSyncableBookings.length}`}
                        </button>
                        <button onClick={onSave} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-black text-white text-[10px] md:text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10">
                            <Check size={15}/> Save Schedule
                        </button>
                    </div>

                    <section className="saas-card p-3 md:p-4 mb-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">Team Calendar</p>
                                <h3 className="text-lg md:text-xl font-bold tracking-tight text-black truncate">
                                    {isWorkspaceCalendar ? 'Business Overview' : selectedCalendar?.name || 'My Calendar'}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {isWorkspaceCalendar
                                        ? `${staffMembersForCoverage.length} staff ${staffMembersForCoverage.length === 1 ? 'calendar' : 'calendars'} in view`
                                        : canEditSelectedCalendar ? 'Editing this calendar' : 'View only calendar'}
                                </p>
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 lg:justify-end">
                                {visibleCalendarOptions.map(calendar => {
                                    const active = selectedCalendarId === calendar.id;
                                    const initials = getStaffInitials(calendar.name);
                                    return (
                                        <button
                                            key={calendar.id}
                                            type="button"
                                            onClick={() => setSelectedCalendarId(calendar.id)}
                                            className={`min-w-[156px] h-12 rounded-lg border px-3 flex items-center gap-3 text-left transition-all ${active ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white text-black border-neutral-200 hover:border-black'}`}
                                        >
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold overflow-hidden ${active ? 'native-gradient-icon text-black' : 'bg-neutral-50 border border-neutral-100 text-black'}`}>
                                                {calendar.photoURL ? <img src={calendar.photoURL} alt="" className="w-full h-full object-cover" /> : calendar.id === 'workspace' ? <Users size={14} /> : initials}
                                            </span>
                                            <span className="min-w-0">
                                                <span className={`block text-sm font-bold truncate ${active ? 'text-white' : 'text-black'}`}>{calendar.name}</span>
                                                <span className={`block text-[8px] font-bold uppercase tracking-[0.16em] truncate ${active ? 'text-white/45' : 'text-neutral-400'}`}>{calendar.username || calendar.role}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {!canEditSelectedCalendar && (
                            <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500">
                                {readOnlyCalendarMessage}
                            </div>
                        )}
                    </section>

                    <div className="space-y-6">
                        <section data-tour="schedule-calendar" className={`saas-card schedule-calendar-card schedule-mode-${calendarViewMode} ${hidePastDays ? 'schedule-forward-days' : ''} overflow-hidden`}>
                            <div className="schedule-calendar-command p-5 md:p-6 border-b border-neutral-100 bg-white">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-neutral-400 mb-2">Calendar Board</p>
                                        <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-black">{calendarTitle}</h3>
                                        <p className="text-sm text-neutral-500 mt-1">{calendarDescription}</p>
                                    </div>
                                    <div className="flex flex-col gap-3 w-full lg:w-auto lg:items-end">
                                        <div className="schedule-scope-toggle flex bg-neutral-100 p-1.5 rounded-lg border border-neutral-200 w-full sm:w-fit">
                                            {['day', 'week', 'month'].map(period => (
                                                <button
                                                    key={period}
                                                    onClick={() => setSchedulePeriod(period)}
                                                    className={`flex-1 sm:flex-none h-10 px-5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${scheduleStatsPeriod === period ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                                                >
                                                    {period}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="schedule-calendar-toolbar flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                                            <div className="schedule-month-switcher flex items-center gap-2 bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 w-full sm:w-fit shadow-sm">
                                                <button type="button" aria-label="Show previous calendar window" title="Previous" onClick={() => moveCalendarWindow(-1)} className="w-10 h-10 rounded-md bg-white border border-neutral-100 text-neutral-500 hover:text-black hover:border-neutral-200 transition-colors flex items-center justify-center shrink-0"><ChevronLeft size={18}/></button>
                                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] min-w-0 sm:min-w-[158px] flex-1 text-center text-black">{calendarWindowLabel}</span>
                                                <button type="button" aria-label="Show next calendar window" title="Next" onClick={() => moveCalendarWindow(1)} className="w-10 h-10 rounded-md bg-white border border-neutral-100 text-neutral-500 hover:text-black hover:border-neutral-200 transition-colors flex items-center justify-center shrink-0"><ChevronRight size={18}/></button>
                                            </div>
                                            <button
                                                type="button"
                                                aria-pressed={hidePastDays}
                                                onClick={toggleHidePastDays}
                                                className={`schedule-hide-toggle h-11 sm:h-auto px-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${hidePastDays ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-neutral-500 border-neutral-200 hover:text-black'}`}
                                            >
                                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${hidePastDays ? 'bg-[#39FF14] border-transparent text-black' : 'bg-neutral-50 border-neutral-200'}`}>
                                                    {hidePastDays && <Check size={11}/>}
                                                </span>
                                                Hide past
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="schedule-compact-stats grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
                                    {scheduleMetricCards.map((item) => {
                                        const IconCmp = item.icon;
                                        return (
                                            <div key={item.label} className="native-stat-card schedule-compact-stat rounded-lg border border-neutral-100 bg-white px-4 py-3 text-black">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-neutral-100 text-black shrink-0">
                                                            <IconCmp size={16}/>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 truncate">{item.label}</p>
                                                            <p className="text-xs font-semibold text-neutral-500 truncate">{item.hint}</p>
                                                        </div>
                                                    </div>
                                                    <p className="metric-value text-2xl md:text-3xl font-black tracking-tight leading-none">{item.value}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={`schedule-calendar-scroll-zone ${calendarViewMode === 'day' ? 'schedule-day-scroll-zone' : ''} p-4 md:p-6 no-scrollbar bg-gradient-to-b from-white to-neutral-50/60`}>
                                <div className={calendarFrameClass}>
                                {(calendarViewMode === 'month' || calendarViewMode === 'week') && (
                                    <div className="schedule-rotate-prompt mb-3 rounded-lg border border-neutral-100 bg-white/85 px-3 py-3 text-black">
                                        <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                                            <RefreshCw size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">Rotate for full calendar</p>
                                            <p className="text-xs font-semibold text-neutral-600 leading-snug">Portrait keeps days in two clean columns. Turn sideways for the full calendar board.</p>
                                        </div>
                                    </div>
                                )}
                                <div className={`calendar-week-heading ${calendarHeaderVisibilityClass} ${calendarHeaderClass} gap-2 md:gap-3 mb-3 rounded-lg bg-white/75 border border-neutral-100 px-2 py-3`}>
                                    {calendarHeaderLabels.map((d) => (
                                        <div key={d} className="text-center text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-neutral-300">{d}</div>
                                    ))}
                                </div>

                                <div className={`schedule-calendar-grid grid ${calendarGridClass} gap-2 md:gap-3`}>
                                    {calendarDisplayDays.map((dateStr, i) => {
                                        if (!dateStr) return <div key={`empty-${i}`} className={`${calendarCellSizeClass} rounded-lg bg-white/35 border border-neutral-100/70`} />;
                                        const dayNum = Number(dateStr.split('-')[2]);
                                        const config = getDayConfig(dateStr);
                                        const isSelected = expandedDate === dateStr;
                                        const isToday = todayStr === dateStr;
                                        const isPastDay = dateStr < todayStr;
                                        const isCustom = Boolean(activeSchedule?.[dateStr]);
                                        const staffCoverage = isWorkspaceCalendar ? getStaffCoverageForDate(dateStr) : [];
                                        const dayBookings = bookingsByDate[dateStr] || { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
                                        const openSlots = Math.max(0, (config.times?.length || 0) - dayBookings.reserved);
                                        const monthLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
                                        const weekdayLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

                                        if (calendarViewMode === 'day') {
                                            const activeDayFocusId = isWorkspaceCalendar && staffCoverage.some(staff => staff.id === overviewDayFocusStaffId)
                                                ? overviewDayFocusStaffId
                                                : 'workspace';
                                            const agendaCalendarId = isWorkspaceCalendar && activeDayFocusId !== 'workspace'
                                                ? activeDayFocusId
                                                : selectedCalendarId;
                                            const agendaConfig = getCalendarDayConfig(agendaCalendarId, dateStr);
                                            const canEditAgendaCalendar = workspaceRole !== 'staff' || agendaCalendarId === activeStaffId;
                                            const agendaStaff = activeDayFocusId !== 'workspace'
                                                ? staffCoverage.find(staff => staff.id === activeDayFocusId)
                                                : null;
                                            const unslottedBookings = selectedDayBookingList.filter(booking => !agendaConfig.times.includes(booking.time));

                                            return (
                                                <div
                                                    key={dateStr}
                                                    className={`schedule-day-agenda-card relative ${calendarCellSizeClass} rounded-lg border p-4 md:p-5 overflow-hidden ${isSelected ? 'schedule-day-selected bg-white text-black border-transparent' : 'bg-white border-neutral-200'}`}
                                                >
                                                    {!isPastDay && (!isWorkspaceCalendar || activeDayFocusId === 'workspace') && (
                                                        <button
                                                            type="button"
                                                            aria-label={config.available ? `Mark ${dateStr} unavailable` : `Mark ${dateStr} available`}
                                                            title={config.available ? 'Mark unavailable' : 'Mark available'}
                                                            onClick={() => toggleDateAvailability(dateStr)}
                                                            className={`schedule-day-agenda-availability ${config.available ? 'is-open' : 'is-closed'}`}
                                                        >
                                                            {config.available ? <Check size={14}/> : <X size={14}/>}
                                                        </button>
                                                    )}

                                                    <div className="schedule-day-agenda-layout grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-5 h-full">
                                                        <div className="flex flex-col min-h-0 pr-0 xl:pr-3">
                                                            <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-neutral-400 mb-2">
                                                                {new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                                            </p>
                                                            <div className="flex items-start justify-between gap-4 mb-5">
                                                                <div>
                                                                    <p className="metric-value text-5xl md:text-6xl font-black tracking-tight leading-none text-black">{dayNum}</p>
                                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                                        {isToday && <span className="rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest bg-black text-white">Today</span>}
                                                                        {isCustom && <span className="rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-500">Custom</span>}
                                                                        <span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${agendaConfig.available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{agendaConfig.available ? 'Open' : 'Closed'}</span>
                                                                    </div>
                                                                    {staffCoverage.length > 0 && (
                                                                        <div className="mt-4">
                                                                            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400 mb-2">Staff on this day</p>
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                {staffCoverage.slice(0, 4).map(staff => (
                                                                                    <button
                                                                                        key={staff.id}
                                                                                        type="button"
                                                                                        onClick={() => setOverviewDayFocusStaffId(staff.id)}
                                                                                        className={`h-9 rounded-full border px-2.5 flex items-center gap-2 transition-all ${activeDayFocusId === staff.id ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-black border-neutral-100 hover:border-black'}`}
                                                                                        title={getStaffDisplayName(staff)}
                                                                                    >
                                                                                        <span className="w-6 h-6 rounded-full bg-neutral-100 text-[8px] font-black text-black flex items-center justify-center overflow-hidden shrink-0">
                                                                                            {staff.photoURL ? <img src={staff.photoURL} alt="" className="w-full h-full object-cover" /> : getStaffInitials(getStaffDisplayName(staff))}
                                                                                        </span>
                                                                                        <span className="text-[9px] font-bold uppercase tracking-widest max-w-[92px] truncate">{getStaffDisplayName(staff)}</span>
                                                                                    </button>
                                                                                ))}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setOverviewDayFocusStaffId('workspace')}
                                                                                    className={`h-9 rounded-full border px-3 text-[9px] font-bold uppercase tracking-widest transition-all ${activeDayFocusId === 'workspace' ? 'native-gradient-button text-black border-transparent shadow-lg' : 'bg-white text-neutral-500 border-neutral-100 hover:border-black hover:text-black'}`}
                                                                                >
                                                                                    Business
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="schedule-day-agenda-panels grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                                                            <div className="schedule-day-timeline-panel rounded-lg border border-neutral-100 bg-white p-3 md:p-4 min-h-0">
                                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400">Slot Timeline</p>
                                                                        <p className="text-sm font-bold text-black">{agendaConfig.times.length || 0} times available</p>
                                                                        {agendaStaff && <p className="text-[10px] font-semibold text-neutral-400 mt-0.5 truncate">{getStaffDisplayName(agendaStaff)}</p>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {!isPastDay && canEditAgendaCalendar && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => startAddingSlot({ dateStr, calendarId: agendaCalendarId, times: agendaConfig.times })}
                                                                                className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shadow-lg shadow-black/10 hover:scale-105 transition-transform"
                                                                                title="Add slot"
                                                                                aria-label="Add slot"
                                                                            >
                                                                                <Plus size={14}/>
                                                                            </button>
                                                                        )}
                                                                        <Clock size={16} className="text-neutral-300" />
                                                                    </div>
                                                                </div>
                                                                <div className="schedule-day-timeline-list space-y-2 max-h-[310px] overflow-y-auto no-scrollbar pr-1">
                                                                    {agendaConfig.times.length ? agendaConfig.times.map(time => {
                                                                        const timeBookings = selectedDayBookingsByTime[time] || [];
                                                                        const hasBookings = timeBookings.length > 0;
                                                                        return (
                                                                            <div key={time} className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-3 py-3">
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                                        <span className="w-8 h-8 rounded-md bg-white border border-neutral-100 flex items-center justify-center shrink-0">
                                                                                            <Clock size={13} className="text-neutral-400"/>
                                                                                        </span>
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-sm font-black tracking-widest text-black">{time}</p>
                                                                                            <p className="text-[10px] text-neutral-400 font-semibold truncate">{hasBookings ? timeBookings.map(booking => booking.clientName || 'Client').join(', ') : 'Available for booking'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="shrink-0 flex items-center gap-2">
                                                                                        {hasBookings && (
                                                                                            <span className="rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest bg-black text-white border-black">
                                                                                                {timeBookings.length} booked
                                                                                            </span>
                                                                                        )}
                                                                                        {!isPastDay && canEditAgendaCalendar ? (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => startEditingDaySlot({ time, dateStr, calendarId: agendaCalendarId })}
                                                                                                className="w-8 h-8 rounded-md border border-neutral-200 bg-white text-neutral-500 flex items-center justify-center hover:border-black hover:text-black transition-colors"
                                                                                                title={`Edit ${time}`}
                                                                                                aria-label={`Edit ${time}`}
                                                                                            >
                                                                                                <Pencil size={13}/>
                                                                                            </button>
                                                                                        ) : (
                                                                                            <span className="rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest bg-white text-neutral-500 border-neutral-200">
                                                                                                Open
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }) : (
                                                                        <div className="rounded-lg border border-dashed border-neutral-200 p-5 text-center text-sm font-medium text-neutral-400">No slots set for this day.</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="schedule-day-bookings-panel rounded-lg border border-neutral-100 bg-white p-3 md:p-4 min-h-0">
                                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400">Bookings</p>
                                                                        <p className="text-sm font-bold text-black">{selectedDayBookingList.length ? 'Synced records' : 'Clear day'}</p>
                                                                    </div>
                                                                    <CalendarCheck size={16} className="text-neutral-300" />
                                                                </div>
                                                                <div className="schedule-day-bookings-list space-y-2 max-h-[310px] overflow-y-auto no-scrollbar pr-1">
                                                                    {selectedDayBookingList.length ? selectedDayBookingList.map(booking => {
                                                                        const statusMeta = getBookingStatusMeta(booking);
                                                                        const clientAvatar = getBookingClientAvatar(booking);
                                                                        return (
                                                                            <div key={booking.id || `${booking.clientName}-${booking.time}`} className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-3 py-3">
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <div className="flex items-start gap-3 min-w-0">
                                                                                        <div className="w-9 h-9 rounded-full bg-white border border-neutral-100 flex items-center justify-center overflow-hidden shrink-0 text-xs font-black text-black">
                                                                                            {clientAvatar ? <img src={clientAvatar} alt="" className="w-full h-full object-cover" /> : (booking.clientName || 'C').charAt(0).toUpperCase()}
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-sm font-black text-black truncate">{booking.clientName || 'Client'}</p>
                                                                                            <p className="text-xs text-neutral-500 mt-1 truncate">{booking.clientPhone || booking.clientEmail || booking.email || 'Client details saved'}</p>
                                                                                            {booking.serviceName && (
                                                                                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.16em] mt-1 truncate">{booking.serviceName}</p>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                                </div>
                                                                                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                                                    <span>{booking.time || 'Unscheduled'}</span>
                                                                                    {booking.staffName && <span className="truncate">With {booking.staffName}</span>}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }) : (
                                                                        <div className="rounded-lg border border-dashed border-neutral-200 p-5 text-center">
                                                                            <CalendarCheck size={20} className="mx-auto mb-2 text-neutral-300" />
                                                                            <p className="text-sm font-bold text-black">No appointments yet</p>
                                                                            <p className="text-xs text-neutral-400 mt-1">New requests for this day will appear here.</p>
                                                                        </div>
                                                                    )}

                                                                    {unslottedBookings.length > 0 && (
                                                                        <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-3">
                                                                            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-violet-700 mb-1">Needs placement</p>
                                                                            <p className="text-xs text-violet-700">{unslottedBookings.length} booking {unslottedBookings.length === 1 ? 'record is' : 'records are'} not tied to a visible slot.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={dateStr}
                                                role="button"
                                                tabIndex="0"
                                                onClick={() => setExpandedDate(dateStr)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setExpandedDate(dateStr);
                                                    }
                                                }}
                                                className={`schedule-day-cell schedule-calendar-tile group relative ${calendarCellSizeClass} rounded-lg border transition-all duration-500 text-left overflow-hidden cursor-pointer ${isSelected ? 'schedule-day-selected bg-white text-black border-transparent scale-[1.004]' : config.available ? 'bg-white border-neutral-200 hover:-translate-y-0.5' : 'bg-neutral-50/90 border-neutral-100 text-neutral-300 grayscale'}`}
                                            >
                                                <div className="schedule-calendar-tile-top">
                                                    <div className="min-w-0">
                                                        <p className="text-[9px] font-black uppercase text-neutral-400">{weekdayLabel}, {monthLabel}</p>
                                                        <div className="flex items-end gap-2 mt-1">
                                                            <span className={`metric-value schedule-calendar-date-number text-4xl font-black tracking-tight leading-none ${!config.available ? 'line-through opacity-40' : ''}`}>{dayNum}</span>
                                                            <div className="flex flex-wrap items-center gap-1 pb-1">
                                                                {isToday && <span className="schedule-calendar-micro-chip is-today">Today</span>}
                                                                {isCustom && <span className="schedule-calendar-micro-chip">Custom</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="schedule-calendar-tile-body">
                                                    <div className="schedule-calendar-events">
                                                        {dayBookings.confirmed > 0 && (
                                                            <span className="schedule-calendar-event-pill is-confirmed">
                                                                {dayBookings.confirmed} confirmed
                                                            </span>
                                                        )}
                                                        {dayBookings.pending > 0 && (
                                                            <span className="schedule-calendar-event-pill is-pending">
                                                                {dayBookings.pending} request{dayBookings.pending === 1 ? '' : 's'}
                                                            </span>
                                                        )}
                                                        {dayBookings.waitlist > 0 && (
                                                            <span className="schedule-calendar-event-pill is-waitlist">
                                                                {dayBookings.waitlist} waitlist
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="schedule-calendar-card-controls">
                                                    {!isPastDay && (
                                                        <button
                                                            type="button"
                                                            aria-label={config.available ? `Mark ${dateStr} unavailable` : `Mark ${dateStr} available`}
                                                            title={config.available ? 'Mark unavailable' : 'Mark available'}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleDateAvailability(dateStr);
                                                            }}
                                                            className={`schedule-day-availability-chip ${config.available ? 'is-open' : 'is-closed'}`}
                                                        >
                                                            {config.available ? <Check size={12}/> : <X size={12}/>}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setExpandedDate(dateStr);
                                                            setSchedulePeriod('day');
                                                        }}
                                                        className="schedule-day-row-action"
                                                        aria-label={`Open full view for ${dateStr}`}
                                                        title="Full day view"
                                                    >
                                                        <Maximize2 size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                </div>
                            </div>
                        </section>

                    </div>
                    {renderSlotEditor()}
                </div>
            );
        };
