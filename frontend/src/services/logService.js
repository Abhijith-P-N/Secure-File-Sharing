import api from './api'

export const getLogs = async () => {
  const response = await api.get('/api/logs')
  return response.data
}
