import React, { useState } from 'react';
import { Container, Form, InputGroup, Badge } from 'react-bootstrap';
import { FaSearch, FaPhone, FaEllipsisV, FaPaperPlane, FaSmile, FaMicrophone, FaPaperclip, FaBell, FaCog, FaQuestionCircle, FaUsers, FaRobot, FaInbox, FaPlus, FaPlay, FaUser, FaMapMarkedAlt, FaClipboardList } from 'react-icons/fa';
import { BsCheckAll } from 'react-icons/bs';
import BiensperienceLogo from '../components/BiensperienceLogo/BiensperienceLogo';

export default {
  title: 'Patterns/Messaging',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete messaging application interface with sidebar, conversation list, chat area, and message input components.',
      },
    },
  },
};

// Contact List Item Component
const ContactListItem = ({ 
  name, 
  message, 
  time, 
  avatar, 
  unreadCount = 0,
  isActive = false,
  isOnline = false,
}) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    cursor: 'pointer',
    backgroundColor: isActive ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
    borderRadius: 'var(--radius-lg)',
    transition: 'var(--transition-normal)',
    borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
      }}>
        {avatar}
      </div>
      {isOnline && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-message-sent)',
          border: '2px solid var(--color-bg-primary)',
        }} />
      )}
      {unreadCount > 0 && (
        <div style={{
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: '20px',
          height: '20px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-bold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 var(--space-1)',
        }}>
          {unreadCount}
        </div>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-1)',
      }}>
        <div style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
          marginLeft: 'var(--space-2)',
        }}>
          {time}
        </div>
      </div>
      <div style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {message}
      </div>
    </div>
  </div>
);

// Message Bubble Component
const MessageBubble = ({ text, time, isSent, isRead }) => (
  <div style={{
    display: 'flex',
    justifyContent: isSent ? 'flex-end' : 'flex-start',
    marginBottom: 'var(--space-4)',
  }}>
    <div style={{
      maxWidth: '70%',
      padding: 'var(--space-4) var(--space-5)',
      backgroundColor: isSent ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
      color: isSent ? 'white' : 'var(--color-text-primary)',
      borderRadius: isSent 
        ? 'var(--radius-2xl) var(--radius-2xl) var(--radius-sm) var(--radius-2xl)'
        : 'var(--radius-2xl) var(--radius-2xl) var(--radius-2xl) var(--radius-sm)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-base)',
        lineHeight: 'var(--line-height-relaxed)',
        marginBottom: 'var(--space-2)',
      }}>
        {text}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 'var(--space-1)',
        fontSize: 'var(--font-size-xs)',
        opacity: 0.8,
      }}>
        <span>{time}</span>
        {isSent && <BsCheckAll size={14} style={{ color: isRead ? 'var(--color-read-receipt)' : 'currentColor' }} />}
      </div>
    </div>
  </div>
);

// Complete Messaging Interface
export const MessagingApp = {
  render: () => {
    const [message, setMessage] = useState('');

    const contacts = [
      // Direct messages (humans)
      { name: 'Gabriel Planner', message: 'Just confirmed the Kyoto temple itinerary!', time: '12:25', avatar: <FaUser />, unreadCount: 0, isActive: true, isOnline: true },
      { name: 'Kelly Traveler', message: 'Found the perfect sunset spot in Santorini', time: '11:45', avatar: <FaUser />, unreadCount: 0, isOnline: true },
      { name: 'Jane Organizer', message: 'Updated the group trip spreadsheet', time: '10:30', avatar: <FaUser />, unreadCount: 1 },
      { name: 'Rachel Pleasure-Seeker', message: 'That spa recommendation was amazing!', time: 'Yesterday', avatar: <FaUser /> },
      { name: 'Flora Adrenaline-Junkie', message: 'Bungee jumping tomorrow — who\'s in?', time: 'Yesterday', avatar: <FaUser />, unreadCount: 4 },

      // Group chats: experiences
      { name: 'Kyoto Experience (Group)', message: 'Kelly: Temple passes uploaded', time: '2 days ago', avatar: <FaMapMarkedAlt />, unreadCount: 2 },
      { name: 'Barcelona Weekend (Experience)', message: 'Jane: Park Güell tickets booked', time: '2 days ago', avatar: <FaMapMarkedAlt /> },

      // Group chats: plans (multiple collaborators)
      { name: 'Rome Trip Plan (Group)', message: 'Marcus: Itinerary v3 ready', time: '3 days ago', avatar: <FaClipboardList /> },
      { name: 'Thailand Island Hopping (Plan)', message: 'Rachel: Ferry times updated', time: '4 days ago', avatar: <FaClipboardList /> },

      { name: 'City Explorers', message: 'New York walking tour recommendations', time: '1 week ago', avatar: <FaUsers />, unreadCount: 2 },
    ];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: 'var(--color-bg-secondary)',
    }}>
      {/* Left Sidebar */}
      <div style={{
        width: '80px',
        backgroundColor: 'var(--color-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-4) 0',
        gap: 'var(--space-4)',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
        }}>
          <BiensperienceLogo type="clean" size="lg" />
        </div>

        {/* Navigation Icons */}
        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
        }}>
          <FaSearch size={20} />
        </button>

        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
        }}>
          <FaInbox size={20} />
        </button>

        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
          position: 'relative',
        }}>
          <FaUsers size={20} />
          <Badge
            bg="danger"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              fontSize: '10px',
              padding: '2px 6px',
            }}
          >
            2
          </Badge>
        </button>

        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
        }}>
          <FaRobot size={20} />
        </button>

        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
        }}>
          <FaBell size={20} />
        </button>

        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
        }}>
          <FaCog size={20} />
        </button>

        <button style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
        }}>
          <FaQuestionCircle size={20} />
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User Avatar */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-message-pending)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: 'pointer',
        }}>
          A
        </div>
      </div>

      {/* Contacts List */}
      <div style={{
        width: '380px',
        backgroundColor: 'var(--color-bg-primary)',
        borderRight: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--color-border-light)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
          }}>
            <h2 style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}>
              Messages
            </h2>
            <Badge
              bg="primary"
              style={{
                fontSize: 'var(--font-size-sm)',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-full)',
              }}
            >
              23
            </Badge>
            <button style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              padding: 'var(--space-2)',
            }}>
              <FaPlus size={20} />
            </button>
          </div>

          {/* Search */}
          <InputGroup style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            padding: 'var(--space-2) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
          }}>
            <FaSearch style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-2)' }} />
            <Form.Control
              placeholder="Search..."
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                boxShadow: 'none',
              }}
            />
          </InputGroup>
        </div>

        {/* Contacts Scroll Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2)',
        }}>
          {contacts.map((contact, index) => (
            <ContactListItem key={index} {...contact} />
          ))}
        </div>

        {/* Add New Chat Button */}
        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--color-border-light)',
        }}>
          <button style={{
            width: '100%',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            transition: 'var(--transition-normal)',
          }}>
            <FaPlus /> Add New Chat
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-primary)',
      }}>
        {/* Chat Header */}
        <div style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
            }}>
              A
            </div>
            <div>
              <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                Marcus Explorer
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-message-sent)',
                }} />
                Online
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              transition: 'var(--transition-normal)',
            }}>
              <FaPhone size={18} />
            </button>
            <button style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'var(--transition-normal)',
            }}>
              <FaEllipsisV size={18} />
            </button>
          </div>
        </div>

        {/* Date Indicator */}
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-4)',
        }}>
          <span style={{
            display: 'inline-block',
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            fontWeight: 'var(--font-weight-medium)',
          }}>
            19 August
          </span>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
        }}>
          <MessageBubble
            text="Hey! Just booked our Kyoto temple passes and sent over the e-tickets."
            time="10:25"
            isRead
          />

          <div style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}>
            <img
              src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=200"
              alt="Kyoto Temple Passes"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-lg)',
                objectFit: 'cover'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                Kyoto_Temple_Passes.pdf
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
              }}>
                420 KB • PDF
              </div>
            </div>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
            }}>
              10:26 <BsCheckAll size={14} style={{ marginLeft: 'var(--space-1)', color: 'var(--color-message-sent)' }} />
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: 'var(--space-6) 0' }}>
            <span style={{
              display: 'inline-block',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
            }}>
              Today
            </span>
          </div>

          <MessageBubble
            text="Should we start at Fushimi Inari right after sunrise and then head to Nishiki Market for breakfast?"
            time="12:25"
            isSent
            isRead
          />

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 'var(--space-4)',
          }}>
            <img
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400"
              alt="Shared"
              style={{
                maxWidth: '70%',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>

          <MessageBubble
            text="Love that plan! After the torii gates, we can take the JR line to Arashiyama for the bamboo grove. I also saved a tiny ramen spot near Gion—best shoyu broth, we have to try it."
            time="12:25"
            isSent
            isRead
          />

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 'var(--space-4)',
          }}>
            <div style={{
              maxWidth: '70%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-primary)',
              borderRadius: 'var(--radius-2xl) var(--radius-2xl) var(--radius-sm) var(--radius-2xl)',
              boxShadow: 'var(--shadow-md)',
            }}>
              <button style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}>
                <FaPlay style={{ color: 'var(--color-primary)', fontSize: '16px', marginLeft: '3px' }} />
              </button>
              <div style={{
                flex: 1,
                height: '40px',
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0px, rgba(255, 255, 255, 0.3) 2px, transparent 2px, transparent 5px)',
                borderRadius: 'var(--radius-sm)',
              }} />
              <div style={{
                color: 'white',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 'var(--space-1)',
              }}>
                <span>02:12</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-xs)' }}>
                  <span>10:26</span>
                  <BsCheckAll size={14} style={{ color: 'var(--color-read-receipt)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div style={{
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--color-border-light)',
          backgroundColor: 'var(--color-bg-primary)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-3)',
          }}>
            <button style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}>
              <FaPaperclip size={20} />
            </button>

            <div style={{
              flex: 1,
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-4)',
            }}>
              <Form.Control
                as="textarea"
                rows={1}
                placeholder="Send a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: 'var(--font-size-base)',
                  resize: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  color: 'var(--color-text-primary)',
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--space-2)',
              }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 'var(--space-2)',
                  }}>
                    <FaSmile size={20} />
                  </button>
                  <button style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 'var(--space-2)',
                  }}>
                    <FaMicrophone size={20} />
                  </button>
                </div>
              </div>
            </div>

            <button style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-lg)',
              flexShrink: 0,
            }}>
              <FaPaperPlane size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  },
};
