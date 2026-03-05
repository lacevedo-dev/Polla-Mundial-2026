
import React from 'react';
import Layout from './components/Layout';
import Landing from './views/Landing';
import Dashboard from './views/Dashboard';
import DesignSystem from './views/DesignSystem';
import BeforeAfter from './views/BeforeAfter';
import Login from './views/Login';
import Register from './views/Register';
import Help from './views/Help';
import EmailVerification from './views/EmailVerification';
import Checkout from './views/Checkout';
import CreateLeague from './views/CreateLeague';
import ManagePayments from './views/ManagePayments';
import JoinLeague from './views/JoinLeague';
import Predictions from './views/Predictions';
import { AppView } from './types';
import { Trophy } from 'lucide-react';
import Ranking from './views/Ranking';

const App: React.FC = () => {
  const [currentView, setCurrentView] = React.useState<AppView>('landing');
  const [registeredEmail, setRegisteredEmail] = React.useState<string>('');

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <Landing onViewChange={setCurrentView} />;
      case 'login':
        return <Login onViewChange={setCurrentView} />;
      case 'register':
        return <Register onViewChange={setCurrentView} onRegisterSuccess={setRegisteredEmail} />;
      case 'email-verification':
        return <EmailVerification onViewChange={setCurrentView} email={registeredEmail} />;
      case 'checkout':
        return <Checkout onViewChange={setCurrentView} />;
      case 'create-league':
        return <CreateLeague onViewChange={setCurrentView} />;
      case 'manage-payments':
        return <ManagePayments onViewChange={setCurrentView} />;
      case 'join-league':
        return <JoinLeague onViewChange={setCurrentView} />;
      case 'help':
        return <Help />;
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'design-system':
        return <DesignSystem />;
      case 'before-after':
        return <BeforeAfter />;
      case 'predictions':
        return <Predictions onViewChange={setCurrentView} />;
      case 'ranking':
        return <Ranking onViewChange={setCurrentView} />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <Layout activeView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;
