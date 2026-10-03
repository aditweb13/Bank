import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TransferView from '../components/TransferView';
import * as api from '../services/api';

vi.mock('../services/api');

describe('TransferView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.getMyBeneficiaries.mockResolvedValue([]);
    api.getCustomerTransfers.mockResolvedValue({ content: [], totalPages: 1, pageNumber: 0 });
  });

  it('shows loading state initially', () => {
    api.getMyAccounts.mockImplementation(() => new Promise(() => {}));
    render(<TransferView />);
    expect(screen.getByText(/Loading account information/i)).toBeInTheDocument();
  });

  it('shows accounts successfully', async () => {
    api.getMyAccounts.mockResolvedValue([{ id: 1, accountNumber: 'AC123', balance: 5000, type: 'SAVINGS' }]);
    render(<TransferView />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading account information/i)).not.toBeInTheDocument();
      expect(screen.getByText(/AC123/i)).toBeInTheDocument();
    });
  });

  it('shows empty state if no accounts', async () => {
    api.getMyAccounts.mockResolvedValue([]);
    render(<TransferView />);
    await waitFor(() => {
      expect(screen.getByText(/No Active Accounts/i)).toBeInTheDocument();
    });
  });

  it('shows error state with retry on failure', async () => {
    api.getMyAccounts.mockRejectedValue(new Error('Network error'));
    render(<TransferView />);
    await waitFor(() => {
      expect(screen.getByText(/Network Connection Error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
