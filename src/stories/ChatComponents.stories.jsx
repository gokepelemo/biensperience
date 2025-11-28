import React, { useState } from 'react';
import { Container, Form, InputGroup, Button } from 'react-bootstrap';
import { FaPaperPlane, FaSmile, FaMicrophone, FaPlus, FaEllipsisH, FaPlay, FaPaperclip, FaFile } from 'react-icons/fa';
import { BsCheckAll } from 'react-icons/bs';

export default {
  title: 'Patterns/Chat Interface',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Chat interface components including message bubbles, input fields, time indicators, and media attachments with proper alignment and styling.',
      },
    },
  },
};

// Message Bubble Component
const MessageBubble = ({ 
  text, 
  time = '11:25', 
  isSent = false, 
  isRead = false,
  hasReply = false,
  replyText = '',
}) => (
  <div style={{
    display: 'flex',
    justifyContent: isSent ? 'flex-end' : 'flex-start',
    marginBottom: 'var(--space-3)',
  }}>
    <div style={{
      maxWidth: '70%',
      minWidth: '120px',
    }}>
      {hasReply && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: isSent ? 'rgba(102, 126, 234, 0.15)' : 'var(--color-bg-tertiary)',
          borderLeft: isSent ? '3px solid var(--color-primary)' : '3px solid var(--color-border-heavy)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          fontStyle: 'italic',
        }}>
          {replyText}
        </div>
      )}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        backgroundColor: isSent ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
        color: isSent ? 'white' : 'var(--color-text-primary)',
        borderRadius: isSent 
          ? 'var(--radius-2xl) var(--radius-2xl) var(--radius-sm) var(--radius-2xl)'
          : 'var(--radius-2xl) var(--radius-2xl) var(--radius-2xl) var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
        fontSize: 'var(--font-size-base)',
        lineHeight: 'var(--line-height-relaxed)',
      }}>
        {text}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 'var(--space-1)',
          marginTop: 'var(--space-2)',
          fontSize: 'var(--font-size-xs)',
          opacity: 0.8,
        }}>
          <span>{time}</span>
          {isSent && <BsCheckAll size={14} style={{ color: isRead ? 'var(--color-read-receipt)' : 'currentColor' }} />}
        </div>
      </div>
    </div>
  </div>
);

// Media Message Bubble
const MediaMessageBubble = ({ 
  type = 'image', // 'image', 'video', 'document', 'audio', 'link'
  time = '11:25',
  isSent = false,
  isRead = false,
  mediaUrl = '',
  fileName = '',
  fileSize = '',
  linkTitle = '',
  linkDescription = '',
  linkUrl = '',
  duration = '02:12',
}) => {
  const renderContent = () => {
    switch (type) {
      case 'video':
      case 'image':
        return (
          <div style={{
            position: 'relative',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            marginBottom: 'var(--space-2)',
            backgroundColor: 'var(--color-bg-tertiary)',
          }}>
            <img 
              src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400" 
              alt="Media content"
              style={{
                width: '100%',
                height: '200px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {type === 'video' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <FaPlay style={{ color: 'white', fontSize: '20px', marginLeft: '4px' }} />
              </div>
            )}
          </div>
        );
      
      case 'document':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            backgroundColor: isSent ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-2)',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: isSent ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FaFile style={{ 
                color: isSent ? 'white' : 'var(--color-primary)', 
                fontSize: '20px' 
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: isSent ? 'white' : 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {fileName}
              </div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: isSent ? 'rgba(255, 255, 255, 0.8)' : 'var(--color-text-muted)',
              }}>
                {fileSize}
              </div>
            </div>
          </div>
        );
      
      case 'audio':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            backgroundColor: isSent ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-full)',
            marginBottom: 'var(--space-2)',
            minWidth: '250px',
          }}>
            <button style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: isSent ? 'white' : 'var(--color-primary)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}>
              <FaPlay style={{ 
                color: isSent ? 'var(--color-primary)' : 'white',
                fontSize: '14px',
                marginLeft: '2px',
              }} />
            </button>
            <div style={{
              flex: 1,
              height: '32px',
              backgroundImage: `repeating-linear-gradient(90deg, ${
                isSent ? 'rgba(255, 255, 255, 0.3)' : 'var(--color-primary)'
              } 0px, ${
                isSent ? 'rgba(255, 255, 255, 0.3)' : 'var(--color-primary)'
              } 2px, transparent 2px, transparent 4px)`,
              borderRadius: 'var(--radius-sm)',
            }} />
            <span style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: isSent ? 'white' : 'var(--color-text-primary)',
              flexShrink: 0,
            }}>
              {duration}
            </span>
          </div>
        );
      
      case 'link':
        return (
          <div style={{
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            marginBottom: 'var(--space-2)',
            border: `2px solid ${isSent ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-border-light)'}`,
          }}>
            <img 
              src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400" 
              alt="Link preview"
              style={{
                width: '100%',
                height: '160px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div style={{
              padding: 'var(--space-4)',
              backgroundColor: isSent ? 'rgba(255, 255, 255, 0.1)' : 'var(--color-bg-secondary)',
            }}>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: isSent ? 'white' : 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                {linkTitle}
                <FaPaperclip style={{ opacity: 0.6, fontSize: '14px' }} />
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: isSent ? 'rgba(255, 255, 255, 0.8)' : 'var(--color-text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                {linkDescription}
              </div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: isSent ? 'rgba(255, 255, 255, 0.6)' : 'var(--color-text-muted)',
                wordBreak: 'break-all',
              }}>
                {linkUrl}
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: isSent ? 'flex-end' : 'flex-start',
      marginBottom: 'var(--space-4)',
    }}>
      <div style={{
        maxWidth: '70%',
        minWidth: '280px',
        backgroundColor: isSent ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
        borderRadius: isSent 
          ? 'var(--radius-2xl) var(--radius-2xl) var(--radius-sm) var(--radius-2xl)'
          : 'var(--radius-2xl) var(--radius-2xl) var(--radius-2xl) var(--radius-sm)',
        padding: type === 'link' || type === 'image' || type === 'video' ? 'var(--space-3)' : 'var(--space-4)',
        boxShadow: 'var(--shadow-md)',
      }}>
        {renderContent()}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 'var(--space-1)',
          fontSize: 'var(--font-size-xs)',
          color: isSent ? 'rgba(255, 255, 255, 0.8)' : 'var(--color-text-muted)',
          padding: type === 'link' || type === 'image' || type === 'video' ? '0 var(--space-1)' : '0',
        }}>
          <span>{time}</span>
          {isSent && <BsCheckAll size={14} style={{ color: isRead ? 'var(--color-read-receipt)' : 'currentColor' }} />}
        </div>
      </div>
    </div>
  );
};

// Chat Conversation
export const ChatBubbles = {
  name: 'Chat Bubbles',
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-secondary)',
    minHeight: '100vh',
    padding: 'var(--space-8)',
  }}>
    <Container style={{ maxWidth: '800px' }}>
      <div style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-2xl)',
        padding: 'var(--space-6)',
        border: '2px dashed var(--color-border-medium)',
        boxShadow: 'var(--shadow-xl)',
      }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-6)',
        }}>
          Chat Bubble Variations
        </h2>

        {/* Text Messages */}
        <MessageBubble text="Hi Rachel! I found an amazing hidden beach in Bali - sending you the coordinates and best time to visit!" time="11:25" isRead />
        <MessageBubble text="Perfect! Adding it to my adventure list 🌊" time="11:27" isSent isRead />
        <MessageBubble text="The sunrise there is incredible. Worth waking up early!" time="11:28" hasReply replyText="Perfect! Adding it to my adventure list 🌊" />
        <MessageBubble text="Already planning to arrive the day before! Thanks Kelly 🙏" time="11:30" isSent hasReply replyText="The sunrise there is incredible. Worth waking up early!" isRead />

        {/* Time Indicator */}
        <div style={{
          textAlign: 'center',
          margin: 'var(--space-6) 0',
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
            Today
          </span>
        </div>

        {/* Media Messages */}
        <MediaMessageBubble type="video" time="11:25" isRead />
        <MediaMessageBubble type="video" time="11:25" isSent isRead />

        <MediaMessageBubble 
          type="document" 
          fileName="Account_report.docx" 
          fileSize="2.5gb • docx"
          time="11:25" 
          isRead 
        />
        <MediaMessageBubble 
          type="document" 
          fileName="Account_report.docx" 
          fileSize="2.5gb • docx"
          time="11:25" 
          isSent 
          isRead 
        />

        <MediaMessageBubble 
          type="link" 
          linkTitle="External Link Title"
          linkDescription="External link description"
          linkUrl="https://www.externallink.com"
          time="11:25" 
          isRead 
        />
        <MediaMessageBubble 
          type="link" 
          linkTitle="External Link Title"
          linkDescription="External link description"
          linkUrl="https://www.externallink.com"
          time="11:25" 
          isSent 
          isRead 
        />

        <MediaMessageBubble type="image" time="11:25" isRead />
        <MediaMessageBubble type="image" time="11:25" isSent isRead />

        <MediaMessageBubble type="audio" duration="02:12" time="11:25" isRead />
        <MediaMessageBubble type="audio" duration="02:12" time="11:25" isSent isRead />

        {/* Message Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'var(--space-6)',
        }}>
          <button style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '2px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            <FaEllipsisH style={{ color: 'var(--color-text-primary)' }} />
          </button>
          <button style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-primary)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <FaEllipsisH style={{ color: 'white' }} />
          </button>
        </div>
      </div>
    </Container>
  </div>
  ),
};

// Chat Input Components
export const ChatInputFields = {
  name: 'Chat Input Fields',
  render: () => {
    const [message, setMessage] = useState('');

    return (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      padding: 'var(--space-8)',
    }}>
      <Container style={{ maxWidth: '700px' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-6)',
        }}>
          Chat Input Variations
        </h2>

        {/* Simple Input with Icons */}
        <div style={{
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <InputGroup style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-full)',
            border: '2px solid var(--color-border-light)',
            padding: 'var(--space-2) var(--space-4)',
          }}>
            <button style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 'var(--space-2)',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}>
              <FaPlus size={20} />
            </button>
            <Form.Control
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: 'var(--font-size-base)',
                padding: 'var(--space-2) var(--space-3)',
                outline: 'none',
                boxShadow: 'none',
              }}
            />
            <button style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 'var(--space-2)',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}>
              <FaMicrophone size={20} />
            </button>
            <button style={{
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              color: 'white',
              marginLeft: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <FaPaperPlane size={16} />
            </button>
          </InputGroup>
        </div>

        {/* Advanced Input with Attachment */}
        <div style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-2xl)',
            border: '2px solid var(--color-border-light)',
            padding: 'var(--space-4)',
          }}>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Send a message..."
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
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border-light)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  transition: 'var(--transition-normal)',
                }}>
                  <FaSmile size={20} />
                </button>
                <button style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  transition: 'var(--transition-normal)',
                }}>
                  <FaMicrophone size={20} />
                </button>
              </div>
              <Button
                style={{
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-3) var(--space-6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                Send <FaPaperPlane size={14} />
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </div>
    );
  },
};
