import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { Contact } from "@shared/schema";
import { Search } from "lucide-react";

interface ContactListProps {
  onSelectContact: (contact: Contact) => void;
}

export default function ContactList({ onSelectContact }: ContactListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "contacts" | "groups">("all");
  
  // Fetch contacts
  const { 
    data: contacts = [],
    isLoading: isLoadingContacts,
  } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });
  
  // Fetch groups
  const { 
    data: groups = [],
    isLoading: isLoadingGroups,
  } = useQuery<Contact[]>({
    queryKey: ['/api/groups'],
  });

  // Filter contacts and groups based on search term and filter type
  const filteredItems = [...(filter === "groups" ? [] : contacts), ...(filter === "contacts" ? [] : groups)]
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.phoneNumber.includes(searchTerm)
    );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (newFilter: "all" | "contacts" | "groups") => {
    setFilter(newFilter);
  };

  return (
    <>
      {/* Search bar */}
      <div className="p-3 border-b border-pazap-dark-border">
        <div className="relative">
          <Input
            type="text"
            placeholder="Buscar contatos ou grupos"
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-pazap-dark-bg text-pazap-dark-text border-pazap-dark-border"
          />
          <Search className="h-5 w-5 absolute left-3 top-2.5 text-pazap-dark-text-secondary" />
        </div>
        <div className="flex mt-2 space-x-1">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("all")}
            className={`px-3 py-1 text-xs flex-1 ${filter === "all" ? "bg-pazap-dark-orange text-white" : "bg-pazap-dark-bg text-pazap-dark-text-secondary"}`}
          >
            Todos
          </Button>
          <Button
            variant={filter === "contacts" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("contacts")}
            className={`px-3 py-1 text-xs flex-1 ${filter === "contacts" ? "bg-pazap-dark-orange text-white" : "bg-pazap-dark-bg text-pazap-dark-text-secondary"}`}
          >
            Contatos
          </Button>
          <Button
            variant={filter === "groups" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("groups")}
            className={`px-3 py-1 text-xs flex-1 ${filter === "groups" ? "bg-pazap-dark-blue text-white" : "bg-pazap-dark-bg text-pazap-dark-text-secondary"}`}
          >
            Grupos
          </Button>
        </div>
      </div>

      {/* Contacts/Groups List */}
      <div className="overflow-y-auto flex-1">
        {/* Contacts Section */}
        {(filter === "all" || filter === "contacts") && (
          <>
            <h3 className="px-4 pt-3 pb-1 text-sm font-medium text-pazap-dark-text-secondary">Contatos</h3>
            {isLoadingContacts ? (
              Array(3).fill(0).map((_, i) => (
                <div key={`contact-skeleton-${i}`} className="px-4 py-3">
                  <div className="flex items-center">
                    <Skeleton className="h-12 w-12 rounded-full mr-3 bg-pazap-dark-surface" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-1 bg-pazap-dark-surface" />
                      <Skeleton className="h-4 w-24 bg-pazap-dark-surface" />
                    </div>
                  </div>
                </div>
              ))
            ) : contacts.length === 0 ? (
              <p className="px-4 py-2 text-sm text-pazap-dark-text-secondary">Nenhum contato encontrado</p>
            ) : (
              <ul className="divide-y divide-pazap-dark-border">
                {contacts
                  .filter(contact => filter === "all" || !contact.isGroup)
                  .filter(contact => 
                    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    contact.phoneNumber.includes(searchTerm)
                  )
                  .map(contact => (
                    <li
                      key={contact.id}
                      className="hover:bg-pazap-dark-bg transition-colors cursor-pointer"
                      onClick={() => onSelectContact(contact)}
                    >
                      <div className="flex items-center px-4 py-3">
                        <div className="h-12 w-12 rounded-full bg-pazap-dark-orange text-white flex items-center justify-center mr-3">
                          <span className="font-semibold">
                            {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-pazap-dark-text">{contact.name}</h4>
                          <p className="text-sm text-pazap-dark-text-secondary">
                            {contact.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}

        {/* Groups Section */}
        {(filter === "all" || filter === "groups") && (
          <>
            <h3 className="px-4 pt-3 pb-1 text-sm font-medium text-pazap-dark-text-secondary">Grupos</h3>
            {isLoadingGroups ? (
              Array(2).fill(0).map((_, i) => (
                <div key={`group-skeleton-${i}`} className="px-4 py-3">
                  <div className="flex items-center">
                    <Skeleton className="h-12 w-12 rounded-full mr-3 bg-pazap-dark-surface" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-1 bg-pazap-dark-surface" />
                      <Skeleton className="h-4 w-24 bg-pazap-dark-surface" />
                    </div>
                  </div>
                </div>
              ))
            ) : groups.length === 0 ? (
              <p className="px-4 py-2 text-sm text-pazap-dark-text-secondary">Nenhum grupo encontrado</p>
            ) : (
              <ul className="divide-y divide-pazap-dark-border">
                {groups
                  .filter(group => filter === "all" || group.isGroup)
                  .filter(group => 
                    group.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(group => (
                    <li
                      key={group.id}
                      className="hover:bg-pazap-dark-bg transition-colors cursor-pointer"
                      onClick={() => onSelectContact(group)}
                    >
                      <div className="flex items-center px-4 py-3">
                        <div className="h-12 w-12 rounded-full bg-pazap-dark-blue text-white flex items-center justify-center mr-3">
                          <span className="font-semibold">
                            {group.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-pazap-dark-text">{group.name}</h4>
                          <p className="text-sm text-pazap-dark-text-secondary">
                            {group.participants && `${group.participants.length} participantes`}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
