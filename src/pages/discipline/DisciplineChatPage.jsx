import React from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';

const DisciplineChatPage = () => {
  const { t } = useLanguage();
  const userId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');
  
  const identityName = "Discipline Master";
  const role = "discipline";

  const relatedContext = {
     schoolId: schoolId ? parseInt(schoolId) : null,
  };

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_dm')}</title>
      </Helmet>
      <div className="p-4 h-full max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('disciplineComm')}</h1>
          <p className="text-muted-foreground">{t('disciplineCommDesc')}</p>
        </div>
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

export default DisciplineChatPage;