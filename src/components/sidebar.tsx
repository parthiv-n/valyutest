'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { createClient } from '@/utils/supabase/client-wrapper';
import {
  MessageSquare,
  MessagesSquare,
  MessageCirclePlus,
  History,
  Settings,
  LogOut,
  Trash2,
  CreditCard,
  BarChart3,
  Plus,
  Building2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/user/settings-modal';
import { SubscriptionModal } from '@/components/user/subscription-modal';
import { useSubscription } from '@/hooks/use-subscription';
import { EnterpriseContactModal } from '@/components/enterprise/enterprise-contact-modal';

interface SidebarProps {
  currentSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewChat?: () => void;
  hasMessages?: boolean;
  useValyuMode?: boolean;
  onModeChange?: (mode: boolean) => void;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export function Sidebar({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  hasMessages = false,
  useValyuMode = true,
  onModeChange,
}: SidebarProps) {
  const { user } = useAuthStore();
  const signOut = useAuthStore((state) => state.signOut);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

  // Sidebar is always open
  const [isOpen, setIsOpen] = useState(true);
  const handleModeTabClick = useCallback((mode: boolean) => {
    if (!onModeChange) return;
    if (mode === useValyuMode) return;
    onModeChange(mode);
  }, [onModeChange, useValyuMode]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  // Fetch chat sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/chat/sessions', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      const { sessions } = await response.json();
      return sessions;
    },
    enabled: !!user
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      return sessionId;
    },
    onSuccess: (sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (currentSessionId === sessionId) {
        onNewChat?.();
      }
    }
  });

  const handleSessionSelect = useCallback((sessionId: string) => {
    onSessionSelect?.(sessionId);
    setShowHistory(false);
  }, [onSessionSelect]);

  const handleNewChat = useCallback(() => {
    onNewChat?.();
    setShowHistory(false);
  }, [onNewChat]);

  // Sidebar is always open, no toggle needed

  // Listen for upgrade modal trigger from rate limit banner
  useEffect(() => {
    const handleShowUpgradeModal = () => setShowSubscription(true);
    window.addEventListener('show-upgrade-modal', handleShowUpgradeModal);
    return () => window.removeEventListener('show-upgrade-modal', handleShowUpgradeModal);
  }, []);

  const handleLogoClick = () => {
    // If there's an active chat (either with session ID or just messages), warn before leaving
    if (currentSessionId || hasMessages) {
      const confirmed = window.confirm(
        user
          ? 'Leave this conversation? Your chat history will be saved.'
          : 'Start a new chat? Your current conversation will be lost.'
      );

      if (confirmed) {
        setShowHistory(false);
        onNewChat?.(); // Call onNewChat to properly reset the chat interface
      }
      return;
    }

    // If on homepage without active chat
    if (pathname === '/') {
      setShowHistory(false);
      return;
    }

    // If on other pages, warn before leaving
    const confirmed = window.confirm(
      'Leave this page? Your current session will be saved, but any unsaved changes will be lost.'
    );

    if (confirmed) {
      setShowHistory(false);
      router.push('/');
    }
  };

  const handleViewUsage = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/customer-portal', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const { redirectUrl } = await response.json();
        window.open(redirectUrl, '_blank');
      }
    } catch (error) {
    }
  };

  // Get subscription status from database
  const subscription = useSubscription();
  const { isPaid } = subscription;

  return (
    <>

      {/* macOS Dock-Style Navigation - Left Side */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300
            }}
            className="fixed left-6 top-6 z-40 h-auto w-[170px] bg-purple-200 dark:bg-purple-900/30 rounded-[32px] bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-20 dark:bg-opacity-30 border border-gray-100 dark:border-purple-500/30 shadow-2xl shadow-blue-500/10 dark:shadow-purple-500/20 py-4 px-4"
          >
            <div className="flex flex-col gap-2">

              {/* Logo */}
              <button
                onClick={handleLogoClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
              >
                <Image
                  src="/nabla.png"
                  alt="Home"
                  width={24}
                  height={24}
                  className="rounded-lg flex-shrink-0"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Home</span>
              </button>

              {/* Mode Tabs */}
              <div className="mt-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400 mb-2">
                  Mode
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Valyu + LLM', value: true },
                    { label: 'LLM Only', value: false },
                  ].map((tab) => {
                    const isActive = useValyuMode === tab.value;
                    return (
                      <button
                        key={tab.label}
                        onClick={() => handleModeTabClick(tab.value)}
                        className={`w-full px-3 py-2 rounded-xl border border-white/60 dark:border-gray-800/60 text-[11px] font-semibold text-gray-700 dark:text-gray-300 transition-all bg-white/30 dark:bg-gray-900/30 backdrop-blur-md shadow-sm ${
                          isActive
                            ? 'ring-2 ring-offset-2 ring-blue-400/60 dark:ring-purple-400/60 ring-offset-white dark:ring-offset-gray-900 text-gray-900 dark:text-white'
                            : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-1" />

              {/* New Chat */}
              {user && (
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
                >
                  <MessageCirclePlus className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">New Chat</span>
                </button>
              )}

              {/* History with Hover Dropdown */}
              <div className="relative group">
                <button
                  onClick={() => {
                    if (!user) {
                      window.dispatchEvent(new CustomEvent('show-auth-modal'));
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    !user
                      ? 'opacity-50 cursor-not-allowed hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm'
                      : 'hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm'
                  }`}
                >
                  <MessagesSquare className={`h-5 w-5 transition-colors flex-shrink-0 ${
                    !user
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    !user
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {!user ? 'History (Sign up)' : 'History'}
                  </span>
                </button>
                
                {/* Hover Dropdown */}
                {user && (
                  <div className="absolute left-full ml-2 top-0 w-64 h-auto max-h-[500px] bg-purple-200 dark:bg-purple-900/30 bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-20 dark:bg-opacity-30 rounded-xl border border-gray-100 dark:border-purple-500/30 shadow-2xl shadow-blue-500/10 dark:shadow-purple-500/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-blue-200/30 dark:border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Chat History</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleNewChat}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Sessions List */}
                    <ScrollArea className="flex-1 px-2 max-h-[400px]">
                      {loadingSessions ? (
                        <div className="space-y-2 p-2">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className="h-16 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl animate-pulse"
                            />
                          ))}
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="flex items-center justify-center h-full p-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                            No chat history yet
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 py-2">
                          {sessions.map((session: ChatSession) => (
                            <div
                              key={session.id}
                              onClick={() => handleSessionSelect(session.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm group cursor-pointer transition-colors border border-transparent hover:border-blue-200/30 dark:hover:border-purple-500/20 ${
                                currentSessionId === session.id ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-500/15 dark:to-purple-500/15 backdrop-blur-md border-blue-300/50 dark:border-purple-400/50' : ''
                              }`}
                            >
                              <MessageSquare className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {session.title}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                  {new Date(session.last_message_at || session.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMutation.mutate(session.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                title="Delete chat"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Divider */}
              {user && !isDevelopment && <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-1" />}

              {/* Billing/Subscription - Hidden in development mode */}
              {user && !isDevelopment && (
                <>
                  {!isPaid ? (
                    <button
                      onClick={() => setShowSubscription(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
                    >
                      <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Upgrade</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleViewUsage}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
                    >
                      <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Usage & Billing</span>
                    </button>
                  )}
                </>
              )}

              {/* Enterprise */}
              {user && process.env.NEXT_PUBLIC_APP_MODE !== 'development' && process.env.NEXT_PUBLIC_ENTERPRISE === 'true' && (
                <button
                  onClick={() => setShowEnterpriseModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
                >
                  <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Enterprise</span>
                </button>
              )}

              {/* Settings */}
              {user && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
                >
                  <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Settings</span>
                </button>
              )}

              {/* Divider */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-1" />

              {/* Log In Button for unauthenticated users */}
              {!user && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('show-auth-modal'));
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-blue-500/30 to-purple-500/30 dark:from-blue-500/20 dark:to-purple-500/20 hover:from-blue-500/40 hover:to-purple-500/40 dark:hover:from-blue-500/30 dark:hover:to-purple-500/30 rounded-xl transition-all duration-200 border border-blue-300/50 dark:border-purple-400/50 relative group"
                >
                  <LogOut className="h-5 w-5 text-blue-600 dark:text-blue-400 rotate-180 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Log in</span>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                </button>
              )}

              {/* User Avatar with Dropdown */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 dark:hover:bg-gray-800/40 backdrop-blur-sm rounded-xl transition-all duration-200 group"
                  >
                    <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600 transition-all flex-shrink-0">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 text-white dark:text-gray-900 font-semibold">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Account</span>
                  </button>

                  {/* Profile Dropdown */}
                  <AnimatePresence>
                    {showProfileMenu && (
                      <>
                        {/* Backdrop to close on click away */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-full ml-4 bottom-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-blue-200/50 dark:border-purple-500/30 rounded-2xl shadow-2xl shadow-blue-500/20 dark:shadow-purple-500/30 py-2 px-1 min-w-[220px] z-50"
                        >
                        {/* User Email */}
                        <div className="px-3 py-2.5 mb-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Signed in as</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {user.email}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gradient-to-r from-transparent via-blue-200/30 dark:via-purple-500/20 to-transparent my-1" />

                        {/* Sign Out */}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            const confirmed = window.confirm('Are you sure you want to sign out?');
                            if (confirmed) {
                              signOut();
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="font-medium">Sign out</span>
                        </button>
                      </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Modals */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <SubscriptionModal
        open={showSubscription}
        onClose={() => setShowSubscription(false)}
      />

      <EnterpriseContactModal
        open={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />
    </>
  );
}
