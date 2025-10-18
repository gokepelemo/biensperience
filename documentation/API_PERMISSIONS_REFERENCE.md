# Permissions API Quick Reference

**Quick guide for managing user permissions on destinations and experiences**

---

## Endpoints

All permission endpoints require authentication (JWT token).

### Destinations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/destinations/:id/permissions` | Add permission |
| `GET` | `/api/destinations/:id/permissions` | Get all permissions |
| `DELETE` | `/api/destinations/:id/permissions/:entityId/:entityType` | Remove permission |
| `PATCH` | `/api/destinations/:id/permissions/:userId` | Update user permission type |

### Experiences

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/experiences/:id/permissions` | Add permission |
| `GET` | `/api/experiences/:id/permissions` | Get all permissions |
| `DELETE` | `/api/experiences/:id/permissions/:entityId/:entityType` | Remove permission |
| `PATCH` | `/api/experiences/:id/permissions/:userId` | Update user permission type |

---

## Add Permission

**Endpoint**: `POST /api/{destinations|experiences}/:id/permissions`

**Add User as Collaborator:**
```json
{
  "_id": "60d5ec49f1b2c8b1f8e4e1a2",
  "entity": "user",
  "type": "collaborator"
}
```

**Add User as Contributor:**
```json
{
  "_id": "60d5ec49f1b2c8b1f8e4e1a2",
  "entity": "user",
  "type": "contributor"
}
```

**Inherit from Destination:**
```json
{
  "_id": "60d5ec49f1b2c8b1f8e4e1a3",
  "entity": "destination"
}
```

**Inherit from Experience:**
```json
{
  "_id": "60d5ec49f1b2c8b1f8e4e1a4",
  "entity": "experience"
}
```

**Response (201):**
```json
{
  "message": "Permission added successfully",
  "destination": { /* full resource with updated permissions */ }
}
```

---

## Get Permissions

**Endpoint**: `GET /api/{destinations|experiences}/:id/permissions`

**Response (200):**
```json
{
  "owner": {
    "userId": "60d5ec49f1b2c8b1f8e4e1a1",
    "name": "John Doe",
    "role": "owner"
  },
  "permissions": [
    {
      "userId": "60d5ec49f1b2c8b1f8e4e1a2",
      "name": "Jane Smith",
      "role": "collaborator"
    },
    {
      "userId": "60d5ec49f1b2c8b1f8e4e1a3",
      "name": "Bob Johnson",
      "role": "contributor"
    }
  ],
  "directPermissions": [
    {
      "_id": "60d5ec49f1b2c8b1f8e4e1a2",
      "entity": "user",
      "type": "collaborator"
    }
  ]
}
```

---

## Remove Permission

**Endpoint**: `DELETE /api/{destinations|experiences}/:id/permissions/:entityId/:entityType`

**Examples:**
- Remove user: `DELETE /api/destinations/60d.../permissions/60d5ec49.../user`
- Remove destination reference: `DELETE /api/experiences/60d.../permissions/60d5ec49.../destination`
- Remove experience reference: `DELETE /api/destinations/60d.../permissions/60d5ec49.../experience`

**Response (200):**
```json
{
  "message": "Permission removed successfully",
  "removed": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a2",
    "entity": "user",
    "type": "collaborator"
  },
  "destination": { /* updated resource */ }
}
```

---

## Update Permission Type

**Endpoint**: `PATCH /api/{destinations|experiences}/:id/permissions/:userId`

**Request Body:**
```json
{
  "type": "collaborator"
}
```

or

```json
{
  "type": "contributor"
}
```

**Response (200):**
```json
{
  "message": "Permission updated successfully",
  "destination": { /* updated resource */ }
}
```

---

## Role Capabilities

| Role | Edit Content | Modify Plan Items | Delete Resource | Manage Permissions |
|------|--------------|-------------------|-----------------|-------------------|
| **Owner** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Collaborator** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Contributor** | ❌ No | ❌ No | ❌ No | ❌ No |

**Note**: Contributor role reserved for future functionality (adding posts/comments).

---

## Error Responses

| Code | Error | Cause |
|------|-------|-------|
| `400` | Invalid ObjectId | Malformed entity ID |
| `400` | Invalid entity type | Must be user/destination/experience |
| `400` | Invalid role type | Must be collaborator/contributor |
| `400` | Permission already exists | Duplicate permission |
| `400` | Circular dependency | Would create infinite loop |
| `401` | Not authorized | User is not owner/collaborator |
| `401` | Only owner can manage | Permission management restricted to owner |
| `404` | Resource not found | Destination/experience doesn't exist |
| `404` | Target not found | Referenced entity doesn't exist |
| `404` | Permission not found | Permission doesn't exist on resource |

---

## Quick Examples

### cURL Examples

**Add collaborator:**
```bash
curl -X POST \
  https://api.biensperience.com/api/destinations/60d5ec49f1b2c8b1f8e4e1a1/permissions \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "_id": "60d5ec49f1b2c8b1f8e4e1a2",
    "entity": "user",
    "type": "collaborator"
  }'
```

**Get permissions:**
```bash
curl -X GET \
  https://api.biensperience.com/api/destinations/60d5ec49f1b2c8b1f8e4e1a1/permissions \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**Remove permission:**
```bash
curl -X DELETE \
  https://api.biensperience.com/api/destinations/60d5ec49f1b2c8b1f8e4e1a1/permissions/60d5ec49f1b2c8b1f8e4e1a2/user \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**Update permission:**
```bash
curl -X PATCH \
  https://api.biensperience.com/api/destinations/60d5ec49f1b2c8b1f8e4e1a1/permissions/60d5ec49f1b2c8b1f8e4e1a2 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "contributor"
  }'
```

### JavaScript/Fetch Examples

**Add collaborator:**
```javascript
const response = await fetch(`/api/destinations/${destinationId}/permissions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    _id: userId,
    entity: 'user',
    type: 'collaborator'
  })
});
const data = await response.json();
```

**Get permissions:**
```javascript
const response = await fetch(`/api/destinations/${destinationId}/permissions`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { owner, permissions } = await response.json();
```

**Remove permission:**
```javascript
const response = await fetch(
  `/api/destinations/${destinationId}/permissions/${userId}/user`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

**Update permission:**
```javascript
const response = await fetch(
  `/api/destinations/${destinationId}/permissions/${userId}`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'contributor'
    })
  }
);
```

---

## Permission Inheritance

### How It Works

1. **Direct permissions**: Explicitly defined on the resource
2. **Inherited permissions**: Pulled from referenced destinations/experiences
3. **Max depth**: 3 levels of inheritance
4. **No circular refs**: System prevents infinite loops
5. **Priority**: Higher roles override (owner > collaborator > contributor)

### Example Chain

```
Experience A
├── user_1: collaborator (direct)
└── inherits from Destination X
    ├── user_2: collaborator (inherited)
    └── inherits from Experience Y
        └── user_3: contributor (inherited)
```

**Result**: Experience A has 3 users with different roles.

---

## Testing

### Postman Collection

Import these into Postman for quick testing:

**Environment Variables:**
- `baseUrl`: `http://localhost:3001` (development)
- `token`: Your JWT token
- `destinationId`: Test destination ID
- `experienceId`: Test experience ID
- `userId`: Test user ID

**Collection structure:**
```
Permissions API
├── Destinations
│   ├── Add User Permission
│   ├── Add Destination Permission
│   ├── Get Permissions
│   ├── Remove Permission
│   └── Update Permission Type
└── Experiences
    ├── Add User Permission
    ├── Add Experience Permission
    ├── Get Permissions
    ├── Remove Permission
    └── Update Permission Type
```

---

## Next Steps

1. **Frontend Integration**: Build UI for managing collaborators
2. **Notifications**: Alert users when added as collaborators
3. **Analytics**: Track permission changes and usage
4. **Mobile Support**: Implement in mobile app

---

**See also**: [PERMISSIONS_FRAMEWORK.md](./PERMISSIONS_FRAMEWORK.md) for complete documentation.
