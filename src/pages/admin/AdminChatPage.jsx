import React from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';

const AdminChatPage = () => {
  const { t } = useLanguage();
  const userId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  const identityName = "Administrator";
  const role = "administrator";

  const relatedContext = {
    schoolId: schoolId ? parseInt(schoolId) : null,
  };

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_admin')}</title>
      </Helmet>
      {/*
        Escape the dashboard <main>'s padding (p-4 md:p-8) and mobile bottom
        nav offset (pb-24) using negative margins, then claim the exact
        remaining viewport height so ChatInterface fills it completely.
        Desktop: sidebar beside main, no top header → h-screen
        Mobile: top header = 65px → h-[calc(100vh-65px)]
      */}
      <div
        className="-mx-4 -mt-4 -mb-24 md:-mx-8 md:-mt-8 md:-mb-8 overflow-hidden"
        style={{ height: 'calc(100vh - 65px)' }}
      >
        <ChatInterface
          currentUserRole={role}
          currentUserId={userId}
          currentUserName={identityName}
          relatedContext={relatedContext}
        />
      </div>
    </>
  );
};

export default AdminChatPage;
