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
      {/* Full height, no padding — chat fills the entire page area */}
      <div className="h-full w-full overflow-hidden">
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
